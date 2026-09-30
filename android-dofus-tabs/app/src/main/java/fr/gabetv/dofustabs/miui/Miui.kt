package fr.gabetv.dofustabs.miui

import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.widget.Toast

/**
 * Ouvre les écrans de réglages propres à MIUI / HyperOS (Xiaomi, Redmi, POCO).
 * Ces écrans ne sont pas documentés officiellement : on essaie plusieurs
 * variantes connues, puis on retombe sur la page de détails de l'application.
 */
object Miui {

    fun isMiui(): Boolean = try {
        val sp = Class.forName("android.os.SystemProperties")
        val get = sp.getMethod("get", String::class.java)
        val value = get.invoke(null, "ro.miui.ui.version.name") as? String
        !value.isNullOrBlank()
    } catch (e: Exception) {
        false
    }

    /** Réglages ▸ Applications ▸ Gérer les applications ▸ Onglets DT ▸ Démarrage automatique */
    fun openAutostart(ctx: Context) {
        val attempts = listOf(
            Intent().setComponent(
                ComponentName(
                    "com.miui.securitycenter",
                    "com.miui.permcenter.autostart.AutoStartManagementActivity"
                )
            ),
            Intent("miui.intent.action.OP_AUTO_START").addCategory(Intent.CATEGORY_DEFAULT),
            Intent("miui.intent.action.OP_AUTO_START").addCategory(Intent.CATEGORY_DEFAULT)
                .setComponent(
                    ComponentName(
                        "com.miui.securitycenter",
                        "com.miui.securitycenter.MainActivity"
                    )
                )
        )
        if (!tryOpen(ctx, attempts)) openAppDetails(ctx)
    }

    /** Réglages MIUI : « Afficher les fenêtres contextuelles en arrière-plan » */
    fun openPopupPermission(ctx: Context) {
        val editor = Intent("miui.intent.action.APP_PERM_EDITOR")
            .setComponent(
                ComponentName(
                    "com.miui.securitycenter",
                    "com.miui.permcenter.permissions.PermissionsEditorActivity"
                )
            )
            .putExtra("extra_pkgname", ctx.packageName)
        val editorLegacy = Intent("miui.intent.action.APP_PERM_EDITOR")
            .putExtra("extra_pkgname", ctx.packageName)
        if (!tryOpen(ctx, listOf(editor, editorLegacy))) openAppDetails(ctx)
    }

    fun openAppDetails(ctx: Context) {
        try {
            ctx.startActivity(
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                    .setData(Uri.parse("package:" + ctx.packageName))
            )
        } catch (e: ActivityNotFoundException) {
            Toast.makeText(ctx, "Ouvre Réglages ▸ Applications ▸ Onglets DT", Toast.LENGTH_LONG).show()
        }
    }

    private fun tryOpen(ctx: Context, intents: List<Intent>): Boolean {
        for (intent in intents) {
            try {
                if (ctx !is android.app.Activity) intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                ctx.startActivity(intent)
                return true
            } catch (e: Exception) {
                // Variante indisponible sur cette version de MIUI : on essaie la suivante.
            }
        }
        return false
    }
}
