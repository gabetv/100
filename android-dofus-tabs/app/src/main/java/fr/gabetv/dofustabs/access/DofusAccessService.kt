package fr.gabetv.dofustabs.access

import android.accessibilityservice.AccessibilityService
import android.graphics.Rect
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.Toast
import fr.gabetv.dofustabs.R

/**
 * Automatise l'écran « Applications récentes » pour basculer vers une instance
 * précise de Dofus Touch (installation principale, application jumelle MIUI,
 * second espace…). Chaque instance apparaît comme une carte distincte portant
 * le nom « Dofus Touch » : le service ouvre les récents puis touche la carte
 * voulue, comme le ferait le joueur, mais instantanément.
 */
class DofusAccessService : AccessibilityService() {

    companion object {
        const val DOFUS_PKG = "com.ankama.dofustouch"
        private const val RECENTS_WAIT_MS = 450L
        private const val VERIFY_WAIT_MS = 700L
        private const val THROTTLE_MS = 800L
        private const val MAX_AUTO_ATTEMPTS = 4

        /** Instance active du service (activé dans les réglages d'accessibilité). */
        @Volatile
        var instance: DofusAccessService? = null
            private set
    }

    private val handler = Handler(Looper.getMainLooper())
    private var lastSwitchAt = 0L

    // Suivi d'une bascule en cours : on attend l'événement confirmant que
    // la fenêtre du jeu est bien revenue au premier plan.
    @Volatile
    private var waitingForSwitch = false

    @Volatile
    private var switchConfirmed = false

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
    }

    override fun onUnbind(intent: android.content.Intent?): Boolean {
        if (instance === this) instance = null
        return super.onUnbind(intent)
    }

    override fun onDestroy() {
        if (instance === this) instance = null
        super.onDestroy()
    }

    override fun onInterrupt() {
        waitingForSwitch = false
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        if (waitingForSwitch &&
            event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED &&
            event.packageName?.toString()?.contains("ankama", ignoreCase = true) == true
        ) {
            switchConfirmed = true
        }
    }

    // ------------------------------------------------------------------
    // API utilisée par la barre flottante
    // ------------------------------------------------------------------

    /** Bascule vers « l'autre » compte : idéal avec 2 instances, fait défiler sinon. */
    fun switchNext() = switchInternal(occurrence = -1, auto = true)

    /** Bascule vers la N-ième carte « Dofus » des récents (0 = la plus récente). */
    fun switchToCard(occurrence: Int) = switchInternal(occurrence.coerceAtLeast(0), auto = false)

    private fun switchInternal(occurrence: Int, auto: Boolean) {
        val now = System.currentTimeMillis()
        if (now - lastSwitchAt < THROTTLE_MS) return
        lastSwitchAt = now

        waitingForSwitch = true
        switchConfirmed = false
        performGlobalAction(GLOBAL_ACTION_RECENTS)
        handler.postDelayed({ clickDofusCard(occurrence, auto, attempt = 0, lastIndex = -1) }, RECENTS_WAIT_MS)
    }

    /**
     * Cherche les cartes « Dofus » dans l'écran des récents et touche celle
     * demandée. En mode auto, si la fenêtre du jeu ne revient pas au premier
     * plan (on a retouché la carte de l'instance déjà active), on essaie la
     * carte suivante.
     */
    private fun clickDofusCard(occurrence: Int, auto: Boolean, attempt: Int, lastIndex: Int) {
        val root = rootInActiveWindow
        if (root == null) {
            if (attempt == 0) {
                // L'animation des récents n'est pas finie : nouvel essai.
                handler.postDelayed({ clickDofusCard(occurrence, auto, attempt + 1, lastIndex) }, 350)
            } else {
                failGracefully()
            }
            return
        }

        val cards = findDofusCards(root)
        if (cards.isEmpty()) {
            if (attempt == 0) {
                handler.postDelayed({ clickDofusCard(occurrence, auto, attempt + 1, lastIndex) }, 350)
            } else {
                performGlobalAction(GLOBAL_ACTION_BACK)
                waitingForSwitch = false
                toast(getString(R.string.toast_no_instance))
            }
            return
        }

        val targetIndex = when {
            auto && lastIndex >= 0 && cards.size > 1 -> (lastIndex + 1) % cards.size
            auto -> if (cards.size >= 2) 1 else 0 // la 1ʳᵉ carte est souvent l'instance active
            else -> occurrence.coerceAtMost(cards.size - 1)
        }

        switchConfirmed = false
        cards[targetIndex].performAction(AccessibilityNodeInfo.ACTION_CLICK)

        handler.postDelayed({
            if (switchConfirmed) {
                // Bascule réussie.
                waitingForSwitch = false
            } else if (auto && attempt < MAX_AUTO_ATTEMPTS - 1) {
                // Aucun changement : on rouvre les récents avant de viser la carte suivante.
                performGlobalAction(GLOBAL_ACTION_RECENTS)
                handler.postDelayed({
                    clickDofusCard(-1, auto = true, attempt = attempt + 1, lastIndex = targetIndex)
                }, RECENTS_WAIT_MS)
            } else {
                waitingForSwitch = false
                if (auto && attempt > 0) {
                    performGlobalAction(GLOBAL_ACTION_BACK)
                    toast(getString(R.string.toast_pick_manually))
                }
                // En mode « carte précise », l'absence de changement signifie le plus
                // souvent que cette instance était déjà au premier plan : rien à dire.
            }
        }, VERIFY_WAIT_MS)
    }

    // ------------------------------------------------------------------
    // Lecture de l'écran des récents
    // ------------------------------------------------------------------

    /**
     * Retourne les nœuds cliquables des cartes dont le titre contient « dofus »,
     * dédoublonnés et triés de haut en bas puis de gauche à droite.
     */
    private fun findDofusCards(root: AccessibilityNodeInfo): List<AccessibilityNodeInfo> {
        val matches = mutableListOf<AccessibilityNodeInfo>()
        collectDofusNodes(root, matches)

        val clickable = matches.mapNotNull { clickableAncestor(it) }
        val unique = dedupeByBounds(clickable)
        return unique.sortedWith(compareBy({ boundsOf(it).top }, { boundsOf(it).left }))
    }

    private fun collectDofusNodes(node: AccessibilityNodeInfo, out: MutableList<AccessibilityNodeInfo>) {
        val text = node.text?.toString() ?: node.contentDescription?.toString()
        if (text != null && text.contains("dofus", ignoreCase = true)) {
            out.add(node)
        }
        val count = node.childCount
        for (i in 0 until count) {
            val child = node.getChild(i) ?: continue
            collectDofusNodes(child, out)
        }
    }

    /** Remonte jusqu'au premier ancêtre cliquable (la carte entière). */
    private fun clickableAncestor(node: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        var current: AccessibilityNodeInfo? = node
        repeat(8) {
            val c = current ?: return null
            if (c.isClickable) return c
            current = c.parent
        }
        return null
    }

    private fun boundsOf(node: AccessibilityNodeInfo): Rect {
        val r = Rect()
        node.getBoundsInScreen(r)
        return r
    }

    /** Plusieurs nœuds d'une même carte portent le titre : on garde le plus grand par zone. */
    private fun dedupeByBounds(nodes: List<AccessibilityNodeInfo>): List<AccessibilityNodeInfo> {
        val kept = mutableListOf<AccessibilityNodeInfo>()
        for (n in nodes) {
            val r = boundsOf(n)
            val duplicate = kept.any {
                val k = boundsOf(it)
                Rect.intersects(k, r) &&
                    (kotlin.math.abs(k.centerX() - r.centerX()) < 60) &&
                    (kotlin.math.abs(k.centerY() - r.centerY()) < 60)
            }
            if (!duplicate) kept.add(n)
        }
        return kept
    }

    private fun failGracefully() {
        waitingForSwitch = false
        toast(getString(R.string.toast_pick_manually))
    }

    private fun toast(message: String) {
        handler.post {
            Toast.makeText(applicationContext, message, Toast.LENGTH_SHORT).show()
        }
    }
}
