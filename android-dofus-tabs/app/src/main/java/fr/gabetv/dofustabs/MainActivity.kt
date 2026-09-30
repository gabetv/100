package fr.gabetv.dofustabs

import android.app.Activity
import android.content.ComponentName
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.text.TextUtils
import android.view.View
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import fr.gabetv.dofustabs.access.DofusAccessService
import fr.gabetv.dofustabs.databinding.ActivityMainBinding
import fr.gabetv.dofustabs.miui.Miui
import fr.gabetv.dofustabs.overlay.OverlayService
import fr.gabetv.dofustabs.prefs.Prefs

/**
 * Écran de configuration : autorisations, réglages MIUI, définition des
 * onglets (un par compte) et contrôles de la barre flottante.
 */
class MainActivity : Activity() {

    private lateinit var binding: ActivityMainBinding
    private var rebuildingEditors = false

    /** Champs de saisie des noms d’onglets, pour sauvegarder aussi en quittant l’écran. */
    private val nameFields = mutableListOf<Pair<Int, EditText>>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupPermissionButtons()
        setupMiuiButtons()
        setupTabCountSpinner()
        setupActionButtons()
    }

    override fun onResume() {
        super.onResume()
        refreshPermissionStates()
        rebuildTabEditors()
    }

    override fun onPause() {
        saveAllNames()
        super.onPause()
    }

    private fun saveAllNames() {
        nameFields.forEach { (index, field) ->
            Prefs.saveTabName(this, index, field.text.toString())
        }
        OverlayService.refresh(this)
    }

    // ------------------------------------------------------------------
    // Étape 1 — autorisations
    // ------------------------------------------------------------------

    private fun setupPermissionButtons() {
        binding.btnOverlayPerm.setOnClickListener {
            startActivity(
                Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName"))
            )
        }
        binding.btnAccessPerm.setOnClickListener {
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
            Toast.makeText(
                this,
                "Dans la liste, touche « Onglets DT » puis active le service",
                Toast.LENGTH_LONG
            ).show()
        }
        binding.btnNotifPerm.setOnClickListener {
            if (Build.VERSION.SDK_INT >= 33) {
                requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 12)
            }
        }
    }

    private fun refreshPermissionStates() {
        setState(binding.tvOverlayStatus, Settings.canDrawOverlays(this))
        setState(binding.tvAccessStatus, isAccessEnabled())
        val notifOk = Build.VERSION.SDK_INT < 33 ||
            checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) ==
                android.content.pm.PackageManager.PERMISSION_GRANTED
        setState(binding.tvNotifStatus, notifOk)
        binding.btnNotifPerm.visibility = if (Build.VERSION.SDK_INT >= 33) View.VISIBLE else View.GONE
    }

    private fun setState(tv: TextView, granted: Boolean) {
        tv.text = getString(if (granted) R.string.perm_granted else R.string.perm_missing)
        tv.setTextColor(getColor(if (granted) R.color.ok else R.color.ko))
    }

    /** Vrai si « Onglets DT » est activé dans Réglages ▸ Accessibilité. */
    private fun isAccessEnabled(): Boolean {
        val expected = ComponentName(this, DofusAccessService::class.java)
        val enabled = Settings.Secure.getString(
            contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: return false
        val splitter = TextUtils.SimpleStringSplitter(':').apply { setString(enabled) }
        while (splitter.hasNext()) {
            val name = ComponentName.unflattenFromString(splitter.next()) ?: continue
            if (name.packageName == expected.packageName) return true
        }
        return false
    }

    // ------------------------------------------------------------------
    // Étape 2 — réglages Xiaomi / MIUI / HyperOS
    // ------------------------------------------------------------------

    private fun setupMiuiButtons() {
        binding.btnMiuiAutostart.setOnClickListener {
            Miui.openAutostart(this)
            Toast.makeText(this, "Active « Onglets DT » dans la liste", Toast.LENGTH_LONG).show()
        }
        binding.btnMiuiPopup.setOnClickListener {
            Miui.openPopupPermission(this)
        }
    }

    // ------------------------------------------------------------------
    // Étape 3 — définition des onglets
    // ------------------------------------------------------------------

    private fun setupTabCountSpinner() {
        val counts = arrayOf("2", "3", "4")
        binding.spTabCount.adapter = ArrayAdapter(
            this, android.R.layout.simple_spinner_item, counts
        ).apply { setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item) }
        binding.spTabCount.setSelection(Prefs.getTabCount(this) - 2)

        binding.spTabCount.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                if (rebuildingEditors) return
                Prefs.setTabCount(this@MainActivity, position + 2)
                rebuildTabEditors()
                OverlayService.refresh(this@MainActivity)
            }

            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }
    }

    /** Une ligne de configuration par onglet : nom, mode, couleur. */
    private fun rebuildTabEditors() {
        rebuildingEditors = true
        nameFields.clear()
        val container = binding.tabsContainer
        container.removeAllViews()
        val modes = resources.getStringArray(R.array.tab_modes)

        for (i in 0 until Prefs.getTabCount(this)) {
            val tab = Prefs.getTab(this, i)

            // --- Ligne 1 : nom + mode ---
            val top = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
            }
            val name = EditText(this).apply {
                setText(tab.name)
                hint = getString(R.string.dialog_tab_name_hint)
                textSize = 14f
                maxLines = 1
                isSingleLine = true
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            }
            val modeSpinner = Spinner(this).apply {
                adapter = ArrayAdapter(
                    this@MainActivity, android.R.layout.simple_spinner_item, modes
                ).apply { setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item) }
                setSelection(tab.mode.ordinal)
            }
            top.addView(name)
            top.addView(modeSpinner)
            nameFields.add(i to name)

            // --- Ligne 2 : couleurs ---
            val colors = RadioGroup(this).apply {
                orientation = RadioGroup.HORIZONTAL
            }
            Prefs.TAB_COLORS.forEach { color ->
                val rb = RadioButton(this).apply {
                    text = "●"
                    textSize = 12f
                    buttonTintList = ColorStateList.valueOf(color)
                    setTextColor(color)
                    tag = color
                    isChecked = color == tab.color
                }
                colors.addView(rb)
            }

            // --- Sauvegardes en direct ---
            name.setOnFocusChangeListener { _, hasFocus ->
                if (!hasFocus) {
                    Prefs.saveTabName(this, i, name.text.toString())
                    OverlayService.refresh(this)
                }
            }
            modeSpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                    Prefs.saveTabMode(this@MainActivity, i, position)
                    OverlayService.refresh(this@MainActivity)
                }

                override fun onNothingSelected(parent: AdapterView<*>?) {}
            }
            colors.setOnCheckedChangeListener { group, checkedId ->
                group.findViewById<RadioButton>(checkedId)?.tag?.let { color ->
                    Prefs.saveTabColor(this, i, color as Int)
                    OverlayService.refresh(this)
                }
            }

            val block = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(0, dp(6), 0, dp(6))
                addView(top)
                addView(colors)
            }
            container.addView(block)

            if (i < Prefs.getTabCount(this) - 1) {
                container.addView(View(this).apply {
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT, dp(1)
                    )
                    setBackgroundColor(Color.parseColor("#14000000"))
                })
            }
        }
        rebuildingEditors = false
    }

    // ------------------------------------------------------------------
    // Actions
    // ------------------------------------------------------------------

    private fun setupActionButtons() {
        binding.btnShowBar.setOnClickListener {
            if (!Settings.canDrawOverlays(this)) {
                Toast.makeText(this, R.string.toast_overlay_first, Toast.LENGTH_LONG).show()
                startActivity(
                    Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName"))
                )
                return@setOnClickListener
            }
            Prefs.setBarEnabled(this, true)
            startForegroundService(Intent(this, OverlayService::class.java))
            Toast.makeText(this, R.string.toast_bar_shown, Toast.LENGTH_LONG).show()
        }

        binding.btnHideBar.setOnClickListener {
            Prefs.setBarEnabled(this, false)
            stopService(Intent(this, OverlayService::class.java))
        }

        binding.btnTestSwap.setOnClickListener {
            val service = DofusAccessService.instance
            if (service == null) {
                Toast.makeText(this, R.string.toast_access_needed, Toast.LENGTH_LONG).show()
                startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
            } else {
                service.switchNext()
            }
        }
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density + 0.5f).toInt()
}
