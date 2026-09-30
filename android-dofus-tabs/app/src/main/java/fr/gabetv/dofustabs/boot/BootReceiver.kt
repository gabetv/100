package fr.gabetv.dofustabs.boot

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Settings
import fr.gabetv.dofustabs.overlay.OverlayService
import fr.gabetv.dofustabs.prefs.Prefs

/** Réaffiche la barre flottante après un redémarrage du téléphone, si elle était activée. */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        if (!Prefs.isBarEnabled(context)) return
        if (!Settings.canDrawOverlays(context)) return
        try {
            context.startForegroundService(Intent(context, OverlayService::class.java))
        } catch (e: Exception) {
            // Restrictions de démarrage en arrière-plan (ex. MIUI sans
            // démarrage automatique autorisé) : la barre repartira à la
            // prochaine ouverture manuelle de l'application.
        }
    }
}
