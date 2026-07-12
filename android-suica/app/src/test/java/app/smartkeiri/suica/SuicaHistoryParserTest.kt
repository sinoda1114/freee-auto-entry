package app.smartkeiri.suica

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class SuicaHistoryParserTest {
    @Test
    fun parsesFareFromBalanceDelta() {
        val raw = DemoData.sampleRawHistory()
        val records = SuicaHistoryParser.parseBlocks(raw)
        assertEquals(2, records.size)
        assertEquals("2024-07-12", records[0].date)

        val items = SuicaHistoryParser.toTransitItems(records)
        assertEquals(1, items.size)
        assertEquals(180, items[0].amount)
        assertNotNull(items[0].description)
    }

    @Test
    fun handoffUrlContainsPayload() {
        val items = SuicaHistoryParser.toTransitItems(
            SuicaHistoryParser.parseBlocks(DemoData.sampleRawHistory()),
        )
        val url = Handoff.buildExpenseUrl("https://example.com", items)
        assert(url.startsWith("https://example.com/expenses/suica?p="))
    }
}
