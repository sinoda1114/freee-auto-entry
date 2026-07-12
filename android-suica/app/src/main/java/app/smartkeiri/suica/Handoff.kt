package app.smartkeiri.suica

import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject

object Handoff {
    fun encodePayload(items: List<SuicaTransitItem>): String {
        val arr = JSONArray()
        for (item in items) {
            arr.put(
                JSONObject()
                    .put("date", item.date)
                    .put("amount", item.amount)
                    .put("balance", item.balance)
                    .put("processType", item.processType)
                    .put("entranceCode", item.entranceCode)
                    .put("exitCode", item.exitCode)
                    .put("region", item.region)
                    .put("sequence", item.sequence)
                    .put("description", item.description),
            )
        }
        val root = JSONObject().put("v", 1).put("items", arr)
        val bytes = root.toString().toByteArray(Charsets.UTF_8)
        return Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
    }

    fun buildExpenseUrl(siteUrl: String, items: List<SuicaTransitItem>): String {
        val base = siteUrl.trimEnd('/')
        val p = encodePayload(items)
        return "$base/expenses/suica?p=$p"
    }
}
