package app.smartkeiri.suica

import android.app.PendingIntent
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.NfcF
import android.os.Bundle
import android.widget.Button
import android.widget.ListView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.browser.customtabs.CustomTabsIntent

class MainActivity : AppCompatActivity() {
    private lateinit var statusText: TextView
    private lateinit var listView: ListView
    private lateinit var openButton: Button
    private lateinit var demoButton: Button

    private var nfcAdapter: NfcAdapter? = null
    private var pendingIntent: PendingIntent? = null
    private var items: List<SuicaTransitItem> = emptyList()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        statusText = findViewById(R.id.statusText)
        listView = findViewById(R.id.historyList)
        openButton = findViewById(R.id.openWebButton)
        demoButton = findViewById(R.id.demoButton)

        nfcAdapter = NfcAdapter.getDefaultAdapter(this)
        if (nfcAdapter == null) {
            statusText.text = "この端末は NFC 非対応です。デモデータで UI を確認できます。"
        } else if (nfcAdapter?.isEnabled != true) {
            statusText.text = "NFC がオフです。設定から有効にしてください。"
        } else {
            statusText.text = "物理 Suica をかざしてください（履歴を読み取ります）"
        }

        pendingIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, javaClass).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )

        openButton.setOnClickListener { openSelectedInBrowser() }
        demoButton.setOnClickListener { loadDemo() }
        listView.choiceMode = ListView.CHOICE_MODE_MULTIPLE
        listView.setOnItemClickListener { _, _, _, _ -> refreshOpenButton() }

        handleNfcIntent(intent)
        refreshOpenButton()
    }

    override fun onResume() {
        super.onResume()
        val adapter = nfcAdapter ?: return
        val filters = arrayOf(IntentFilter(NfcAdapter.ACTION_TECH_DISCOVERED))
        val techLists = arrayOf(arrayOf(NfcF::class.java.name))
        adapter.enableForegroundDispatch(this, pendingIntent, filters, techLists)
    }

    override fun onPause() {
        super.onPause()
        nfcAdapter?.disableForegroundDispatch(this)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleNfcIntent(intent)
    }

    private fun handleNfcIntent(intent: Intent?) {
        if (intent == null) return
        val action = intent.action ?: return
        if (action != NfcAdapter.ACTION_TECH_DISCOVERED &&
            action != NfcAdapter.ACTION_TAG_DISCOVERED &&
            action != NfcAdapter.ACTION_NDEF_DISCOVERED
        ) {
            return
        }
        val tag: Tag = @Suppress("DEPRECATION")
        intent.getParcelableExtra(NfcAdapter.EXTRA_TAG) ?: return
        try {
            val raw = SuicaNfcReader().readHistory(tag)
            val records = SuicaHistoryParser.parseBlocks(raw)
            val transit = SuicaHistoryParser.toTransitItems(records)
            showItems(transit)
            statusText.text = "読取成功: 履歴 ${records.size} 件 / 経費候補 ${transit.size} 件"
        } catch (e: Exception) {
            statusText.text = "読取失敗: ${e.message}"
            Toast.makeText(this, e.message ?: "読取失敗", Toast.LENGTH_LONG).show()
        }
    }

    private fun loadDemo() {
        val records = SuicaHistoryParser.parseBlocks(DemoData.sampleRawHistory())
        val transit = SuicaHistoryParser.toTransitItems(records)
        showItems(transit)
        statusText.text = "デモデータ: 経費候補 ${transit.size} 件（実カードではありません）"
    }

    private fun showItems(transit: List<SuicaTransitItem>) {
        items = transit
        val labels = transit.map { item ->
            "${item.date}  ¥${item.amount}  ${item.description}"
        }
        listView.adapter = android.widget.ArrayAdapter(
            this,
            android.R.layout.simple_list_item_multiple_choice,
            labels,
        )
        for (i in transit.indices) {
            listView.setItemChecked(i, true)
        }
        refreshOpenButton()
    }

    private fun selectedItems(): List<SuicaTransitItem> {
        val out = ArrayList<SuicaTransitItem>()
        for (i in items.indices) {
            if (listView.isItemChecked(i)) out.add(items[i])
        }
        return out
    }

    private fun refreshOpenButton() {
        val count = selectedItems().size
        openButton.isEnabled = count > 0
        openButton.text = if (count > 0) {
            "選択した${count}件をスマート経理で登録"
        } else {
            "明細を選択してください"
        }
    }

    private fun openSelectedInBrowser() {
        val selected = selectedItems()
        if (selected.isEmpty()) {
            Toast.makeText(this, "明細を選択してください", Toast.LENGTH_SHORT).show()
            return
        }
        val url = Handoff.buildExpenseUrl(BuildConfig.SITE_URL, selected)
        try {
            CustomTabsIntent.Builder().build().launchUrl(this, Uri.parse(url))
        } catch (_: Exception) {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        }
    }
}
