import React, { createContext, useContext, useEffect, useState } from 'react'

const LanguageContext = createContext()

export const TRANSLATIONS = {
  en: {
    language: 'Language Settings',
    selectLanguage: 'Select App Language (भाषा चुनें)',
    english: 'English',
    hindi: 'हिंदी (Hindi)',
    profile: 'Profile',
    account: 'Account',
    bookings: 'Bookings',
    wallet: 'Wallet',
    support: 'Support',
    logout: 'Sign out',
    kyc: 'Aadhaar Verification',
    jobs: 'Jobs & Assignments',
    contractors: 'Vendor / Contractor',
    corporate: 'Corporate',
    home: 'Home',
    save: 'Save',
    cancel: 'Cancel',
    edit: 'Edit',
  },
  hi: {
    language: 'भाषा सेटिंग्स',
    selectLanguage: 'ऐप की भाषा चुनें',
    english: 'English',
    hindi: 'हिंदी (Hindi)',
    profile: 'प्रोफ़ाइल',
    account: 'खाता',
    bookings: 'बुकिंग',
    wallet: 'वॉलेट',
    support: 'सहायता',
    logout: 'साइन आउट',
    kyc: 'आधार सत्यापन',
    jobs: 'काम और जॉब्स',
    contractors: 'ठेकेदार / वेंडर',
    corporate: 'कॉर्पोरेट',
    home: 'होम',
    save: 'सहेजें',
    cancel: 'रद्द करें',
    edit: 'संपादन',
  }
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    return localStorage.getItem('staffivaa_lang') || 'en'
  })

  // Initialize Google Translate Script using Google Maps / Cloud API authorization
  useEffect(() => {
    const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

    window.googleTranslateElementInit = () => {
      if (window.google && window.google.translate) {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: 'en',
            includedLanguages: 'en,hi',
            autoDisplay: false,
            layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
          },
          'google_translate_element'
        )
      }
    }

    if (!document.getElementById('google-translate-script')) {
      const script = document.createElement('script')
      script.id = 'google-translate-script'
      script.type = 'text/javascript'
      script.src = `//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit${mapsApiKey ? `&key=${mapsApiKey}` : ''}`
      script.async = true
      document.body.appendChild(script)
    }

    if (!document.getElementById('google_translate_element')) {
      const div = document.createElement('div')
      div.id = 'google_translate_element'
      div.style.display = 'none'
      document.body.appendChild(div)
    }
  }, [])

  // Auto apply cookie on load if set to Hindi
  useEffect(() => {
    if (lang === 'hi') {
      applyGoogleTranslate('hi')
    }
  }, [])

  const applyGoogleTranslate = (targetLang) => {
    const domain = window.location.hostname
    const gtValue = targetLang === 'hi' ? '/en/hi' : '/en/en'

    // Set translation cookies
    document.cookie = `googtrans=${gtValue}; path=/; domain=${domain}`
    document.cookie = `googtrans=${gtValue}; path=/;`

    document.documentElement.lang = targetLang

    // Select in Google Translate dropdown if loaded
    const selectElem = document.querySelector('.goog-te-combo')
    if (selectElem) {
      selectElem.value = targetLang
      selectElem.dispatchEvent(new Event('change'))
    }
  }

  const setLanguage = (newLang) => {
    setLangState(newLang)
    localStorage.setItem('staffivaa_lang', newLang)
    applyGoogleTranslate(newLang)

    // Smoothly reload page DOM if needed to force full page translation render
    const selectElem = document.querySelector('.goog-te-combo')
    if (selectElem) {
      selectElem.value = newLang
      selectElem.dispatchEvent(new Event('change'))
    } else {
      window.location.reload()
    }
  }

  const t = (key, fallback = '') => {
    return TRANSLATIONS[lang]?.[key] || fallback || key
  }

  return (
    <LanguageContext.Provider value={{ lang, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    return {
      lang: localStorage.getItem('staffivaa_lang') || 'en',
      setLanguage: () => {},
      t: (key, fallback = '') => fallback || key,
    }
  }
  return context
}
