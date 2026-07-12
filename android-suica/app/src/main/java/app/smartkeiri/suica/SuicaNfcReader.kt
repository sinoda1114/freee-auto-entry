package app.smartkeiri.suica

import android.nfc.Tag
import android.nfc.tech.NfcF
import java.io.ByteArrayOutputStream
import java.io.IOException

/**
 * 物理 Suica（FeliCa）の利用履歴サービス 0x090F を Read Without Encryption で読む。
 *
 * 一度に多く読むと応答が短く失敗するため、4ブロックずつ分割して読む。
 */
class SuicaNfcReader {
    companion object {
        const val HISTORY_SERVICE_CODE = 0x090f
        const val HISTORY_BLOCK_COUNT = 20
        /** FeliCa / Suica で安定しやすい1コマンドあたりのブロック数 */
        const val BLOCKS_PER_COMMAND = 4
    }

    fun readHistory(tag: Tag): ByteArray {
        val nfcF = NfcF.get(tag) ?: throw IOException("NfcF に対応していません")
        nfcF.connect()
        try {
            nfcF.timeout = 10_000
            val idm = tag.id
            if (idm.size < 8) {
                throw IOException("IDm が不正です（${idm.size} bytes）")
            }

            val out = ByteArrayOutputStream(HISTORY_BLOCK_COUNT * 16)
            var offset = 0
            while (offset < HISTORY_BLOCK_COUNT) {
                val count = minOf(BLOCKS_PER_COMMAND, HISTORY_BLOCK_COUNT - offset)
                val chunk = readWithoutEncryption(
                    nfcF = nfcF,
                    idm = idm,
                    serviceCode = HISTORY_SERVICE_CODE,
                    startBlock = offset,
                    blockCount = count,
                )
                out.write(chunk)
                offset += count
            }
            return out.toByteArray()
        } finally {
            try {
                nfcF.close()
            } catch (_: Exception) {
                // ignore
            }
        }
    }

    private fun readWithoutEncryption(
        nfcF: NfcF,
        idm: ByteArray,
        serviceCode: Int,
        startBlock: Int,
        blockCount: Int,
    ): ByteArray {
        require(blockCount in 1..BLOCKS_PER_COMMAND) { "blockCount が不正です" }

        val serviceCodeList = byteArrayOf(
            (serviceCode and 0xff).toByte(),
            ((serviceCode shr 8) and 0xff).toByte(),
        )
        val blockList = ByteArray(blockCount * 2)
        for (i in 0 until blockCount) {
            blockList[i * 2] = 0x80.toByte()
            blockList[i * 2 + 1] = (startBlock + i).toByte()
        }

        // len + cmd + IDm(8) + svcCount + svc(2) + blockCount + blockList
        val request = ByteArray(14 + blockList.size)
        request[0] = request.size.toByte()
        request[1] = 0x06 // Read Without Encryption
        System.arraycopy(idm, 0, request, 2, 8)
        request[10] = 1 // number of services
        request[11] = serviceCodeList[0]
        request[12] = serviceCodeList[1]
        request[13] = blockCount.toByte()
        System.arraycopy(blockList, 0, request, 14, blockList.size)

        val response = try {
            nfcF.transceive(request)
        } catch (e: IOException) {
            throw IOException(
                "かざし直しが必要です（通信切断: ${e.message}）。カードを裏面中央にしばらく当ててください。",
                e,
            )
        }

        if (response.isEmpty()) {
            throw IOException("履歴読み取り応答が空です。かざし直してください。")
        }

        // Android は先頭に Length を含む応答を返す想定
        if (response.size < 12) {
            val hex = response.joinToString("") { "%02X".format(it) }
            throw IOException(
                "履歴読み取り応答が短すぎます（${response.size} bytes: $hex）。" +
                    "カードを動かさず裏面中央に当て直してください。",
            )
        }

        val status1 = response[10].toInt() and 0xff
        val status2 = response[11].toInt() and 0xff
        if (status1 != 0 || status2 != 0) {
            throw IOException(
                "履歴読み取り失敗 status=%02X%02X（ブロック %d〜）。別の物理 Suica か、かざし位置を変えて再試行してください。"
                    .format(status1, status2, startBlock),
            )
        }
        if (response.size < 13) {
            throw IOException("履歴読み取り応答にブロック数がありません")
        }

        val returnedBlocks = response[12].toInt() and 0xff
        val dataOffset = 13
        val expected = returnedBlocks * 16
        if (returnedBlocks != blockCount) {
            throw IOException(
                "要求 $blockCount ブロックに対し $returnedBlocks ブロックしか返りませんでした",
            )
        }
        if (response.size < dataOffset + expected) {
            throw IOException(
                "履歴データが不足しています（必要 ${dataOffset + expected}, 実際 ${response.size}）",
            )
        }
        return response.copyOfRange(dataOffset, dataOffset + expected)
    }
}
