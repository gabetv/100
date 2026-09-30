package fr.gabetv.dofustabs.overlay

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import fr.gabetv.dofustabs.MainActivity
import fr.gabetv.dofustabs.R
import fr.gabetv.dofustabs.access.DofusAccessService
import fr.gabetv.dofustabs.prefs.Prefs
import fr.gabetv.dofustabs.prefs.TabConfig
import fr.gabetv.dofustabs.prefs.TabMode

/**
 * Affiche la barre d'onglets (ou sa bulle compacte) au-dessus de toutes les
 * applications, jeu inclus. Chaque onglet bascule vers une instance de Dofus
 * Touch : lancement direct pour l'espace principal, ou via le service
 * d'accessibilité pour les multiples installations (application jumelle MIUI,
 * second espace…).
 */
class OverlayService : Service() {

    companion object {
        const val ACTION_REFRESH = "fr.gabetv.dofustabs.REFRESH"
        private const val CHANNEL_ID = "overlay_channel"
        private const val NOTIF_ID = 41

        @Volatile
        var isRunning = false
            private set

        /** Reconstruit la barre après un changement de réglages (si elle tourne). */
        fun refresh(ctx: Context) {
            if (isRunning) {
                ctx.startService(Intent(ctx, OverlayService::class.java).setAction(ACTION_REFRESH))
            }
        }
    }

    private lateinit var wm: WindowManager
    private val handler = Handler(Looper.getMainLooper())

    private var currentView: View? = null
    private var params: WindowManager.LayoutParams? = null
    private var collapsed = false

    // Mode diffusion : le pavé tactile propage les taps vers toutes les instances.
    private var broadcastOn = false
    private var padView: View? = null
    private var padParams: WindowManager.LayoutParams? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        isRunning = true
        wm = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        startForeground(NOTIF_ID, buildNotification())

        if (!Settings.canDrawOverlays(this)) {
            Toast.makeText(this, R.string.toast_overlay_first, Toast.LENGTH_LONG).show()
            stopSelf()
            return
        }
        collapsed = Prefs.isCollapsed(this)
        showCurrentView()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_REFRESH && currentView != null) {
            showCurrentView()
        }
        return START_STICKY
    }

    override fun onDestroy() {
        hidePad()
        removeView()
        isRunning = false
        super.onDestroy()
    }

    // ------------------------------------------------------------------
    // Notification (service de premier plan)
    // ------------------------------------------------------------------

    private fun buildNotification(): Notification {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, getString(R.string.notif_channel_name), NotificationManager.IMPORTANCE_MIN)
        )
        val openApp = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )
        return Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_swap)
            .setContentTitle(getString(R.string.app_name))
            .setContentText(getString(R.string.notif_text))
            .setContentIntent(openApp)
            .setOngoing(true)
            .build()
    }

    // ------------------------------------------------------------------
    // Fenêtres
    // ------------------------------------------------------------------

    private fun newParams(w: Int, h: Int): WindowManager.LayoutParams {
        return WindowManager.LayoutParams(
            w, h,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = Prefs.getPosX(this@OverlayService)
            y = Prefs.getPosY(this@OverlayService)
        }
    }

    private fun showCurrentView() {
        removeView()
        collapsed = Prefs.isCollapsed(this)
        val view = if (collapsed) buildBubble() else buildBar()
        currentView = view
        try {
            wm.addView(view, params)
        } catch (e: Exception) {
            stopSelf()
        }
    }

    private fun removeView() {
        currentView?.let {
            try {
                wm.removeView(it)
            } catch (e: IllegalArgumentException) {
                // Vue déjà détachée : sans conséquence.
            }
        }
        currentView = null
    }

    // ------------------------------------------------------------------
    // Barre d'onglets
    // ------------------------------------------------------------------

    @SuppressLint("ClickableViewAccessibility")
    private fun buildBar(): View {
        val view = LayoutInflater.from(this).inflate(R.layout.overlay_bar, null)
        params = newParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT
        )

        val tabsContainer = view.findViewById<LinearLayout>(R.id.tabsContainer)
        rebuildTabs(tabsContainer)

        val handle = view.findViewById<TextView>(R.id.handle)
        // Poignée dédiée + toute la surface libre de la barre (les onglets gardent leurs clics).
        val p = params!!
        attachDrag(view, handle, p, persist = true, snap = false, onTap = null, onLong = { openSettings() })
        attachDrag(view, view, p, persist = true, snap = false, onTap = null, onLong = { openSettings() })

        val btnBroadcast = view.findViewById<TextView>(R.id.btnBroadcast)
        updateBroadcastButton(btnBroadcast)
        btnBroadcast.setOnClickListener { setBroadcast(!broadcastOn) }

        view.findViewById<TextView>(R.id.btnMin).setOnClickListener {
            setBroadcast(false)
            Prefs.setCollapsed(this, true)
            showCurrentView()
        }
        view.findViewById<TextView>(R.id.btnClose).setOnClickListener {
            Prefs.setBarEnabled(this, false)
            stopSelf()
        }
        return view
    }

    private fun rebuildTabs(container: LinearLayout) {
        container.removeAllViews()
        val count = Prefs.getTabCount(this)
        for (i in 0 until count) {
            container.addView(buildTabButton(Prefs.getTab(this, i)))
        }
    }

    private fun buildTabButton(tab: TabConfig): View {
        val tv = TextView(this)
        tv.text = tab.name
        tv.setTextColor(Color.WHITE)
        tv.textSize = 13f
        tv.setTypeface(tv.typeface, android.graphics.Typeface.BOLD)
        tv.gravity = Gravity.CENTER
        tv.maxLines = 1
        tv.setPadding(dp(14), dp(6), dp(14), dp(6))
        tv.minWidth = dp(56)

        val bg = GradientDrawable().apply {
            setColor(tab.color)
            cornerRadius = dp(20).toFloat()
            setStroke(dp(1), 0x55FFFFFF)
        }
        tv.background = bg

        val lp = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, dp(40)
        ).apply {
            marginStart = dp(4)
            marginEnd = dp(4)
        }
        tv.layoutParams = lp

        tv.setOnClickListener {
            it.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
            onTabClicked(tab)
        }
        tv.setOnLongClickListener {
            openSettings()
            true
        }
        return tv
    }

    private fun onTabClicked(tab: TabConfig) {
        when (tab.mode) {
            TabMode.DIRECT_MAIN -> launchMainInstance()
            TabMode.NEXT_INSTANCE -> withAccess { it.switchNext() }
            TabMode.RECENT_CARD_2,
            TabMode.RECENT_CARD_3,
            TabMode.RECENT_CARD_4 -> withAccess { it.switchToCard(tab.cardOccurrence()) }
        }
    }

    /** Lance (ou ramène au premier plan) l'installation principale du jeu : toujours fiable. */
    private fun launchMainInstance() {
        val launch = packageManager.getLaunchIntentForPackage(DofusAccessService.DOFUS_PKG)
        if (launch == null) {
            Toast.makeText(this, "Dofus Touch introuvable sur ce téléphone", Toast.LENGTH_LONG).show()
            return
        }
        launch.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
        )
        startActivity(launch)
    }

    private inline fun withAccess(action: (DofusAccessService) -> Unit) {
        val service = DofusAccessService.instance
        if (service == null) {
            Toast.makeText(this, R.string.toast_access_needed, Toast.LENGTH_LONG).show()
            openSettings()
        } else {
            action(service)
        }
    }

    // ------------------------------------------------------------------
    // Bulle compacte
    // ------------------------------------------------------------------

    @SuppressLint("ClickableViewAccessibility")
    private fun buildBubble(): View {
        val view = LayoutInflater.from(this).inflate(R.layout.overlay_bubble, null)
        params = newParams(dp(54), dp(54))
        attachDrag(
            view, view, params!!,
            persist = true,
            snap = true,
            onTap = {
                Prefs.setCollapsed(this, false)
                showCurrentView()
            },
            onLong = { openSettings() }
        )
        return view
    }

    // ------------------------------------------------------------------
    // Mode diffusion (multibox) : pavé tactile partagé
    // ------------------------------------------------------------------

    private fun setBroadcast(on: Boolean) {
        if (on == broadcastOn) return
        broadcastOn = on
        if (on) showPad() else hidePad()
        currentView?.findViewById<TextView>(R.id.btnBroadcast)?.let { updateBroadcastButton(it) }
        Toast.makeText(
            this,
            if (on) R.string.broadcast_on_toast else R.string.broadcast_off_toast,
            Toast.LENGTH_SHORT
        ).show()
    }

    private fun updateBroadcastButton(tv: TextView) {
        val bg = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            if (broadcastOn) {
                setColor(0xFFF59E0B.toInt())
                setStroke(dp(1), 0xAAFFFFFF.toInt())
            } else {
                setColor(0x22FFFFFF)
                setStroke(dp(1), 0x44FFFFFF)
            }
        }
        tv.background = bg
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun showPad() {
        if (padView != null) return
        val view = LayoutInflater.from(this).inflate(R.layout.overlay_pad, null)
        val p = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = Prefs.getPosX(this@OverlayService)
            y = Prefs.getPosY(this@OverlayService) + dp(64)
        }
        padParams = p
        padView = view

        attachDrag(view, view.findViewById(R.id.padHandle), p, persist = false, snap = false, onTap = null, onLong = {})
        view.findViewById<TextView>(R.id.btnPadClose).setOnClickListener { setBroadcast(false) }

        val touch = view.findViewById<View>(R.id.padTouch)
        touch.setOnTouchListener { v, event ->
            if (event.actionMasked == MotionEvent.ACTION_DOWN) {
                val rx = event.x / v.width
                val ry = event.y / v.height
                dispatchPadTap(rx, ry, v as android.view.ViewGroup, event.x, event.y)
            }
            true
        }
        try {
            wm.addView(view, p)
        } catch (e: Exception) {
            padView = null
            setBroadcast(false)
        }
    }

    private fun hidePad() {
        padView?.let {
            try {
                wm.removeView(it)
            } catch (e: IllegalArgumentException) {
                // Vue déjà détachée : sans conséquence.
            }
        }
        padView = null
        padParams = null
    }

    /** Diffuse le tap sur toutes les fenêtres du jeu et laisse une trace visuelle sur le pavé. */
    private fun dispatchPadTap(rx: Float, ry: Float, pad: android.view.ViewGroup, px: Float, py: Float) {
        pad.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
        showTapMarker(pad, px, py)
        withAccess { it.dispatchToVisible(rx, ry) }
    }

    /** Petit rond blanc qui s'estompe à l'endroit touché sur le pavé. */
    private fun showTapMarker(pad: android.view.ViewGroup, px: Float, py: Float) {
        val size = dp(26)
        val marker = View(this).apply {
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(0x55FFFFFF)
                setStroke(dp(1), 0xAAFFFFFF.toInt())
            }
        }
        pad.addView(marker, android.view.ViewGroup.LayoutParams(size, size))
        marker.x = px - size / 2f
        marker.y = py - size / 2f
        marker.animate()
            .alpha(0f)
            .setDuration(450)
            .withEndAction { pad.removeView(marker) }
            .start()
    }

    // ------------------------------------------------------------------
    // Déplacement au doigt (barre et bulle)
    // ------------------------------------------------------------------

    @SuppressLint("ClickableViewAccessibility")
    private fun attachDrag(
        root: View,
        touchTarget: View,
        params: WindowManager.LayoutParams,
        persist: Boolean,
        snap: Boolean,
        onTap: (() -> Unit)?,
        onLong: () -> Unit
    ) {
        val slop = ViewConfiguration.get(this).scaledTouchSlop
        touchTarget.setOnTouchListener(object : View.OnTouchListener {
            private var startX = 0f
            private var startY = 0f
            private var paramX = 0
            private var paramY = 0
            private var moved = false
            private var longPressFired = false
            private var longPressRunnable: Runnable? = null

            override fun onTouch(v: View, event: MotionEvent): Boolean {
                val p = params
                when (event.actionMasked) {
                    MotionEvent.ACTION_DOWN -> {
                        startX = event.rawX
                        startY = event.rawY
                        paramX = p.x
                        paramY = p.y
                        moved = false
                        longPressFired = false
                        longPressRunnable = Runnable {
                            if (!moved) {
                                longPressFired = true
                                root.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
                                onLong()
                            }
                        }.also { handler.postDelayed(it, ViewConfiguration.getLongPressTimeout().toLong()) }
                        return true
                    }

                    MotionEvent.ACTION_MOVE -> {
                        val dx = event.rawX - startX
                        val dy = event.rawY - startY
                        if (!moved && (Math.abs(dx) > slop || Math.abs(dy) > slop)) {
                            moved = true
                            longPressRunnable?.let { handler.removeCallbacks(it) }
                        }
                        if (moved) {
                            p.x = paramX + dx.toInt()
                            p.y = paramY + dy.toInt()
                            try {
                                wm.updateViewLayout(root, p)
                            } catch (e: IllegalArgumentException) {
                                // Vue détachée entre-temps : ignorer.
                            }
                        }
                        return true
                    }

                    MotionEvent.ACTION_UP -> {
                        longPressRunnable?.let { handler.removeCallbacks(it) }
                        if (moved) {
                            if (snap) snapToEdge(root, p)
                            if (persist) Prefs.savePosition(this@OverlayService, p.x, p.y)
                        } else if (!longPressFired && onTap != null) {
                            onTap()
                        }
                        return true
                    }

                    MotionEvent.ACTION_CANCEL -> {
                        longPressRunnable?.let { handler.removeCallbacks(it) }
                        return true
                    }
                }
                return false
            }
        })
    }

    /** Colle la bulle au bord de l'écran le plus proche. */
    private fun snapToEdge(view: View, p: WindowManager.LayoutParams) {
        val res = resources.displayMetrics
        val center = p.x + view.width / 2
        p.x = if (center < res.widthPixels / 2) 0 else res.widthPixels - view.width
        p.y = p.y.coerceIn(0, (res.heightPixels - view.height).coerceAtLeast(0))
        try {
            wm.updateViewLayout(view, p)
        } catch (e: IllegalArgumentException) {
            // Vue détachée entre-temps : ignorer.
        }
    }

    private fun openSettings() {
        val intent = Intent(this, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        startActivity(intent)
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density + 0.5f).toInt()
}
