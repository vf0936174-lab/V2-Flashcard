// src/components/DonateButton.jsx
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';



const STORAGE_KEY = 'v2flashcard_donated_date';
function todayString() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

const DONATE_HIDDEN = true; // set to true to hide the donate button and modal
export default function DonateButton() {
    if (DONATE_HIDDEN) return null;
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [donatedToday, setDonatedToday] = useState(false);
  const [justPaid, setJustPaid] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setDonatedToday(stored === todayString());
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored !== todayString()) {
      localStorage.removeItem(STORAGE_KEY);
      setDonatedToday(false);
    }
  }, []);

  function openModal() {
    setOpen(true);
    setJustPaid(false);
  }

  function closeModal() {
    setOpen(false);
    setProcessing(false);
    setJustPaid(false);
  }

  function handleBuy() {
    setProcessing(true);
    setTimeout(() => {
      const today = todayString();
      localStorage.setItem(STORAGE_KEY, today);
      setDonatedToday(true);
      setProcessing(false);
      setJustPaid(true);
    }, 900);
  }

  const modal = (
    <div className="donate-modal-overlay" role="dialog" aria-modal="true" aria-label={t('donateModalTitle')}>
      <div className="panel donate-large-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0 }}>{t('donateModalTitle')}</h3>
            <div className="text-small muted" style={{ marginTop: 6 }}>{t('donateModalMessage')}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {!donatedToday ? (
              <button className="btn" onClick={handleBuy} disabled={processing}>
                {processing ? t('donateProcessing') : `${t('donateAction')} • ${t('donatePrice')}`}
              </button>
            ) : (
              <div style={{ color: '#1b5e20', fontWeight: 600 }}>{t('donatePaidLabel')}</div>
            )}
            <button className="btn btn--ghost" onClick={closeModal}>{donatedToday ? 'OK' : 'Cancel'}</button>
          </div>
        </div>

        <div style={{ marginTop: 18, lineHeight: 1.5 }}>
          {donatedToday || justPaid ? (
            <div className="muted" style={{ color: '#1b5e20', fontWeight: 500 }}>{t('donateThanks')}</div>
          ) : (
            <div className="muted">{t('donateNoThanks')}</div>
          )}

          {/* optional extra info */}
          <div style={{ marginTop: 12 }} className="text-small muted">
            {t('donatePrice')} • {t('donateAction')}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        aria-label={t('donateButtonAria')}
        title={t('donateTooltip')}
        onClick={openModal}
        className="btn btn--square donate-button"
        style={{
          width: 40,
          height: 40,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          border: '1px solid rgba(5, 253, 75, 0.89)',
          background: '#08571a7f',
          color: '#05f815',
          cursor: 'pointer',
          fontSize: 18,
          lineHeight: 1
        }}
      >
        <span aria-hidden>☕︎</span>
      </button>

      {open && createPortal(modal, document.body)}

      {!open && justPaid && (
        <div style={{ display: 'inline-block', marginLeft: 8, color: '#1b5e20', fontSize: 13 }}>
          {t('donateThanks')}
        </div>
      )}
    </>
  );
}
