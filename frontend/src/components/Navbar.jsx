import { NavLink } from 'react-router-dom'

export default function Navbar() {
    const link = (to, label) => (
        <NavLink
            to={to}
            className={({ isActive }) =>
                `text-sm font-medium transition-colors ${isActive
                    ? 'text-gold border-b-2 border-gold pb-1'
                    : 'text-gray-500 hover:text-gold-light'
                }`
            }
        >
            {label}
        </NavLink>
    )

    return (
        <nav className="sticky top-0 z-50 flex items-center justify-between px-6 h-[60px] bg-bg-surface border-b border-border backdrop-blur-md">
            <NavLink to="/" className="text-xl font-bold text-gold tracking-[3px]" style={{ fontFamily: 'var(--font-display)' }}>
                ⚔ LOREWARDEN
            </NavLink>
            <div className="flex gap-8">
                {link('/', 'Dashboard')}
                {link('/karakter', 'Karakter')}
                {link('/session', 'Sesi Bermain')}
                {link('/map', 'Map')}
                {link('/music', 'Music')}
            </div>
        </nav>
    )
}
