package app.smartkeiri.suica

import android.nfc.Tag
import android.nfc.tech.NfcF
import java.io.IOException

/**
 * 物理 Suica（FeliCa）の利用履歴サービス 0x090F を Read Without Encryption で読む。
 */
class SuicaNfcReader {
    companion object {
        const val HISTORY_SERVICE_CODE = 0x090f
        const val HISTORY_BLOCK_COUNT = 20
    }

    fun readHistory(tag: Tag): ByteArray {
        val nfcF = NfcF.get(tag) ?: throw IOException("NfcF に対応していません")
        nfcF.connect()
        try {
            val idm = tag.id
            return readWithoutEncryption(
                nfcF = nfcF,
                idm = idm,
                serviceCode = HISTORY_SERVICE_CODE,
                blockCount = HISTORY_BLOCK_COUNT,
            )
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
        blockCount: Int,
    ): ByteArray {
        require(idm.size >= 8) { "IDm が不正です" }
        require(blockCount in 1..20) { "blockCount が不正です" }

        val serviceCodeList = byteArrayOf(
            (serviceCode and 0xff).toByte(),
            ((serviceCode shr 8) and 0xff).toByte(),
        )
        val blockList = ByteArray(blockCount * 2)
        for (i in 0 until blockCount) {
            blockList[i * 2] = 0x80.toByte()
            blockList[i * 2 + 1] = i.toByte()
        }

        val request = ByteArray(14 + blockList.size)
        request[0] = request.size.toByte()
        request[1] = 0x06 // Read Without Encryption
        System.arraycopy(idm, 0, request, 2, 8)
        request[10] = 1 // number of services
        request[11] = serviceCodeList[0]
        request[12] = serviceCodeList[1]
        request[13] = blockCount.toByte()
        System.arraycopy(blockList, 0, request, 14, blockList.size)

        val response = nfcF.transceive(request)
        if (response.size < 13) {
            throw IOException("履歴読み取り応答が短すぎます (${response.size})")
        }
        val status1 = response[10].toInt() and 0xff
        val status2 = response[11].toInt() and 0xff
        if (status1 != 0 || status2 != 0) {
            throw IOException("履歴読み取り失敗 status=%02X%02X".format(status1, status2))
        }
        val returnedBlocks = response[12].toInt() and 0xff
        val dataOffset = 13
        val expected = returnedBlocks * 16
        if (response.size < dataOffset + expected) {
            throw IOException("履歴データが不足しています")
        }
        return response.copyOfRange(dataOffset, dataOffset + expected)
    }
}
