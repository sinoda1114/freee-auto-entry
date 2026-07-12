package app.smartkeiri.suica

/**
 * Suica 履歴ブロック（サービス 0x090F）のパース。
 * Web 側 lib/suica/history.ts と同仕様。
 */
data class SuicaHistoryRecord(
    val date: String?,
    val processType: Int,
    val terminalType: Int,
    val entranceCode: Int,
    val exitCode: Int,
    val balance: Int,
    val sequence: Int,
    val region: Int,
    val rawHex: String,
)

data class SuicaTransitItem(
    val date: String,
    val amount: Int,
    val balance: Int,
    val processType: Int,
    val entranceCode: Int,
    val exitCode: Int,
    val region: Int,
    val sequence: Int,
    val description: String,
)

object SuicaHistoryParser {
    private val expenseProcessTypes = setOf(0x01, 0x0f, 0x46, 0x49)

    fun parseBlock(block: ByteArray): SuicaHistoryRecord? {
        if (block.size < 16) return null
        if (block.take(16).all { it == 0.toByte() }) return null

        val dateWord = readU16Be(block, 4)
        val year = 2000 + (dateWord shr 9)
        val month = (dateWord shr 5) and 0x0f
        val day = dateWord and 0x1f
        val dateValid = month in 1..12 && day in 1..31 && year >= 2000
        val date = if (dateValid) {
            "%04d-%02d-%02d".format(year, month, day)
        } else {
            null
        }

        return SuicaHistoryRecord(
            date = date,
            terminalType = block[0].toInt() and 0xff,
            processType = block[1].toInt() and 0xff,
            entranceCode = readU16Be(block, 6),
            exitCode = readU16Be(block, 8),
            balance = readU16Le(block, 10),
            sequence = readU16Be(block, 13) shr 4,
            region = block[15].toInt() and 0xff,
            rawHex = block.take(16).joinToString("") { "%02x".format(it) },
        )
    }

    fun parseBlocks(data: ByteArray): List<SuicaHistoryRecord> {
        val out = ArrayList<SuicaHistoryRecord>()
        var offset = 0
        while (offset + 16 <= data.size) {
            val slice = data.copyOfRange(offset, offset + 16)
            parseBlock(slice)?.let { out.add(it) }
            offset += 16
        }
        return out
    }

    fun toTransitItems(records: List<SuicaHistoryRecord>): List<SuicaTransitItem> {
        val items = ArrayList<SuicaTransitItem>()
        for (i in records.indices) {
            val record = records[i]
            val date = record.date ?: continue
            if (record.processType !in expenseProcessTypes) continue

            val older = records.getOrNull(i + 1)
            val amount = if (older != null) older.balance - record.balance else 0
            if (amount <= 0) continue

            items.add(
                SuicaTransitItem(
                    date = date,
                    amount = amount,
                    balance = record.balance,
                    processType = record.processType,
                    entranceCode = record.entranceCode,
                    exitCode = record.exitCode,
                    region = record.region,
                    sequence = record.sequence,
                    description = describe(record),
                ),
            )
        }
        return items
    }

    fun describe(record: SuicaHistoryRecord): String {
        val process = when (record.processType) {
            0x01 -> "運賃"
            0x0f -> "バス"
            0x46 -> "物販"
            0x49 -> "物販取消"
            else -> "種別0x%02x".format(record.processType)
        }
        if (record.processType == 0x46 || record.processType == 0x49) {
            return "Suica $process"
        }
        val from = "駅%04X".format(record.entranceCode)
        val to = "駅%04X".format(record.exitCode)
        return "Suica $process $from→$to"
    }

    private fun readU16Be(bytes: ByteArray, offset: Int): Int {
        return ((bytes[offset].toInt() and 0xff) shl 8) or (bytes[offset + 1].toInt() and 0xff)
    }

    private fun readU16Le(bytes: ByteArray, offset: Int): Int {
        return (bytes[offset].toInt() and 0xff) or ((bytes[offset + 1].toInt() and 0xff) shl 8)
    }
}
