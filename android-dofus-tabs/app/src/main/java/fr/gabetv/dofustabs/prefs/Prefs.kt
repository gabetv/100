package fr.gabetv.dofustabs.prefs

import android.content.Context
import android.content.SharedPreferences

/** Un onglet de la barre flottante = un compte configuré par le joueur. */
enum class TabMode {
    DIRECT_MAIN,     // Lancement direct de l'instance principale (toujours fiable)
    NEXT_INSTANCE,   // Cycle : bascule vers l'autre instance la plus récente
    RECENT_CARD_2,   // 2ᵉ carte "Dofus" de l'écran Applications récentes
    RECENT_CARD_3,   // 3ᵉ carte
    RECENT_CARD_4    // 4ᵉ carte
}

data class TabConfig(
    val index: Int,
    var name: String,
    var mode: TabMode,
    var color: Int
) {
    /** Index (0-based) de la carte à viser dans les récents, ou -1 pour le cycle auto. */
    fun cardOccurrence(): Int = when (mode) {
        TabMode.RECENT_CARD_2 -> 1
        TabMode.RECENT_CARD_3 -> 2
        TabMode.RECENT_CARD_4 -> 3
        else -> -1
    }
}

object Prefs {
    const val NAME = "onglets_dt"

    val TAB_COLORS = intArrayOf(
        0xFFF59E0B.toInt(), // orange
        0xFF3B82F6.toInt(), // bleu
        0xFF8B5CF6.toInt(), // violet
        0xFF10B981.toInt()  // vert
    )

    const val MAX_TABS = 4

    private const val KEY_BAR_ENABLED = "bar_enabled"
    private const val KEY_COLLAPSED = "collapsed"
    private const val KEY_POS_X = "pos_x"
    private const val KEY_POS_Y = "pos_y"
    private const val KEY_TAB_COUNT = "tab_count"

    private val DEFAULT_NAMES = arrayOf("Compte A", "Compte B", "Compte C", "Compte D")

    private fun sp(ctx: Context): SharedPreferences =
        ctx.getSharedPreferences(NAME, Context.MODE_PRIVATE)

    // ---- État global ----

    fun isBarEnabled(ctx: Context): Boolean = sp(ctx).getBoolean(KEY_BAR_ENABLED, false)
    fun setBarEnabled(ctx: Context, enabled: Boolean) {
        sp(ctx).edit().putBoolean(KEY_BAR_ENABLED, enabled).apply()
    }

    fun isCollapsed(ctx: Context): Boolean = sp(ctx).getBoolean(KEY_COLLAPSED, false)
    fun setCollapsed(ctx: Context, collapsed: Boolean) {
        sp(ctx).edit().putBoolean(KEY_COLLAPSED, collapsed).apply()
    }

    fun getPosX(ctx: Context): Int = sp(ctx).getInt(KEY_POS_X, 0)
    fun getPosY(ctx: Context): Int = sp(ctx).getInt(KEY_POS_Y, 120)
    fun savePosition(ctx: Context, x: Int, y: Int) {
        sp(ctx).edit().putInt(KEY_POS_X, x).putInt(KEY_POS_Y, y).apply()
    }

    fun getTabCount(ctx: Context): Int {
        val n = sp(ctx).getInt(KEY_TAB_COUNT, 2)
        return n.coerceIn(2, MAX_TABS)
    }

    fun setTabCount(ctx: Context, count: Int) {
        sp(ctx).edit().putInt(KEY_TAB_COUNT, count.coerceIn(2, MAX_TABS)).apply()
    }

    // ---- Onglets ----

    fun getTab(ctx: Context, index: Int): TabConfig {
        val p = sp(ctx)
        val name = p.getString("tab_${index}_name", null)
            ?: DEFAULT_NAMES.getOrElse(index) { "Compte ${'A' + index}" }
        val modeOrdinal = p.getInt(
            "tab_${index}_mode",
            if (index == 0) TabMode.DIRECT_MAIN.ordinal else TabMode.NEXT_INSTANCE.ordinal
        )
        val mode = TabMode.entries.getOrElse(modeOrdinal) { TabMode.NEXT_INSTANCE }
        val color = p.getInt("tab_${index}_color", TAB_COLORS[index % TAB_COLORS.size])
        return TabConfig(index, name, mode, color)
    }

    fun saveTabName(ctx: Context, index: Int, name: String) {
        val clean = name.trim().ifBlank { DEFAULT_NAMES.getOrElse(index) { "Compte ${'A' + index}" } }
        sp(ctx).edit().putString("tab_${index}_name", clean.take(12)).apply()
    }

    fun saveTabMode(ctx: Context, index: Int, modeOrdinal: Int) {
        sp(ctx).edit().putInt("tab_${index}_mode", modeOrdinal).apply()
    }

    fun saveTabColor(ctx: Context, index: Int, color: Int) {
        sp(ctx).edit().putInt("tab_${index}_color", color).apply()
    }
}
