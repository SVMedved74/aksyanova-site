/* Сайт Елены Аксяновой — черновик.
   JS только для мелочей: меню на телефоне, пометки черновика, окно оплаты,
   запасной вид превью «Карты разговора». Без аналитики и внешних скриптов. */

(function () {
  'use strict';

  /* ---------- 1. Меню на телефоне и планшете ---------- */

  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');

  function setMenu(open) {
    if (!toggle || !nav) return;
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
    var label = toggle.querySelector('.nav-toggle__label');
    if (label) label.textContent = open ? 'Закрыть' : 'Меню';
  }

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      setMenu(toggle.getAttribute('aria-expanded') !== 'true');
    });

    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        setMenu(false);
        toggle.focus();
      }
    });
  }

  /* ---------- 2. Пометки черновика: скрыть / показать ---------- */
  /* Чтобы показать Елене «чистый» вид. Сами пометки остаются в коде. */

  var marksBtn = document.querySelector('[data-marks-toggle]');
  if (marksBtn) {
    marksBtn.addEventListener('click', function () {
      var off = document.body.classList.toggle('marks-off');
      marksBtn.textContent = off ? 'Показать пометки' : 'Скрыть пометки';
    });
  }

  /* ---------- 3. Оплата — заглушка ---------- */

  // TODO: подключить ЮKassa. Сейчас кнопки «Оплатить» (data-pay="название услуги")
  // только открывают окно с просьбой написать в Telegram. После подключения
  // здесь нужно вести на платёжную ссылку ЮKassa для выбранной услуги.

  var dialog = document.getElementById('pay-dialog');
  var serviceEl = dialog ? dialog.querySelector('[data-pay-service]') : null;
  var lastTrigger = null;

  function openPay(trigger) {
    if (!dialog || typeof dialog.showModal !== 'function') {
      // Старый браузер без <dialog> — сразу в Telegram
      window.open('https://t.me/Elenaross8', '_blank', 'noopener');
      return;
    }
    lastTrigger = trigger;
    if (serviceEl) serviceEl.textContent = trigger.getAttribute('data-pay') || '';
    dialog.showModal();
  }

  if (dialog) {
    // Клик по затемнению вокруг окна закрывает его
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', function () {
      if (lastTrigger) lastTrigger.focus();
    });
  }

  /* ---------- Общий обработчик кликов ---------- */

  document.addEventListener('click', function (e) {
    var payBtn = e.target.closest('[data-pay]');
    if (payBtn) {
      openPay(payBtn);
      return;
    }

    if (e.target.closest('[data-dialog-close]') && dialog) {
      dialog.close();
      return;
    }

    // Ссылки-заглушки (href="#") не прокручивают страницу наверх
    if (e.target.closest('a[data-todo-link]')) {
      e.preventDefault();
    }
  });

  /* ---------- 4. Превью «Карты разговора» ---------- */
  /* Пока файла img/karta-preview.png нет, вместо значка «картинка не загрузилась»
     показываем пустой лист. */

  var sheetImg = document.querySelector('.sheet img');
  if (sheetImg) {
    var markMissing = function () {
      var sheet = sheetImg.closest('.sheet');
      if (sheet) sheet.classList.add('is-missing');
    };
    sheetImg.addEventListener('error', markMissing);
    if (sheetImg.complete && sheetImg.naturalWidth === 0) markMissing();
  }
})();
