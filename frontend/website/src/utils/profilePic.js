// Shared helpers for the user's profile picture.
// The picture is stored as a base64 data URL in localStorage under PIC_KEY.
// Any component that wants to show the avatar should use `useProfilePic()`
// and call `setProfilePic(...)` / `clearProfilePic()` to update it so that
// every mounted avatar re-renders instantly (without a page reload).

import { useEffect, useState } from 'react'

export const PIC_KEY = 'profile_pic_b64'
const EVENT_NAME = 'profile-pic-change'

export function getProfilePic() {
    try {
        return localStorage.getItem(PIC_KEY) || null
    } catch {
        return null
    }
}

export function setProfilePic(dataUrl) {
    try {
        if (dataUrl) localStorage.setItem(PIC_KEY, dataUrl)
        else localStorage.removeItem(PIC_KEY)
    } catch { /* ignore quota errors */ }
    // Notify same-tab listeners (the native "storage" event only fires across tabs).
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: dataUrl || null }))
}

export function clearProfilePic() {
    setProfilePic(null)
}

// React hook — returns the current profile pic (or null) and re-renders any
// component that uses it whenever the pic is updated anywhere in the app.
export function useProfilePic() {
    const [pic, setPic] = useState(() => getProfilePic())

    useEffect(() => {
        const onCustom = (e) => setPic(e?.detail ?? getProfilePic())
        const onStorage = (e) => {
            if (!e.key || e.key === PIC_KEY) setPic(getProfilePic())
        }
        window.addEventListener(EVENT_NAME, onCustom)
        window.addEventListener('storage', onStorage)
        return () => {
            window.removeEventListener(EVENT_NAME, onCustom)
            window.removeEventListener('storage', onStorage)
        }
    }, [])

    return pic
}
