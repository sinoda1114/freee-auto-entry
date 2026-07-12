package app.smartkeiri.suica

/** NFC なし端末や UI 確認用の合成履歴（新しい順）。 */
object DemoData {
    fun sampleRawHistory(): ByteArray {
        val newer = makeBlock(
            processType = 0x01,
            year = 2024,
            month = 7,
            day = 12,
            entrance = 0x0a01,
            exit = 0x0b02,
            balance = 1000,
            sequence = 2,
        )
        val older = makeBlock(
            processType = 0x01,
            year = 2024,
            month = 7,
            day = 11,
            entrance = 0x0c03,
            exit = 0x0d04,
            balance = 1180,
            sequence = 1,
        )
        return newer + older
    }

    private fun makeBlock(
        processType: Int,
        year: Int,
        month: Int,
        day: Int,
        entrance: Int,
        exit: Int,
        balance: Int,
        sequence: Int,
    ): ByteArray {
        val y = year - 2000
        val dateWord = (y shl 9) or (month shl 5) or day
        val block = ByteArray(16)
        block[0] = 0x16
        block[1] = processType.toByte()
        block[4] = ((dateWord shr 8) and 0xff).toByte()
        block[5] = (dateWord and 0xff).toByte()
        block[6] = ((entrance shr 8) and 0xff).toByte()
        block[7] = (entrance and 0xff).toByte()
        block[8] = ((exit shr 8) and 0xff).toByte()
        block[9] = (exit and 0xff).toByte()
        block[10] = (balance and 0xff).toByte()
        block[11] = ((balance shr 8) and 0xff).toByte()
        val seq = sequence shl 4
        block[13] = ((seq shr 8) and 0xff).toByte()
        block[14] = (seq and 0xff).toByte()
        return block
    }
}
