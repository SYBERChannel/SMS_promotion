/* ================================================
   SMS Промо — Frontend Scripts
   Форма заявки, валидация, AJAX, мобильное меню
   ================================================ */

(function () {
    'use strict';

    /* ---- Mobile menu ---- */
    const burgerBtn = document.getElementById('burgerBtn');
    const mobileNav = document.getElementById('mobileNav');

    if (burgerBtn && mobileNav) {
        burgerBtn.addEventListener('click', function () {
            const isOpen = mobileNav.classList.toggle('open');
            burgerBtn.classList.toggle('open', isOpen);
            burgerBtn.setAttribute('aria-expanded', isOpen);
        });

        // Close on nav link click
        mobileNav.querySelectorAll('a').forEach(function (link) {
            link.addEventListener('click', function () {
                mobileNav.classList.remove('open');
                burgerBtn.classList.remove('open');
            });
        });

        // Close on outside click
        document.addEventListener('click', function (e) {
            if (!burgerBtn.contains(e.target) && !mobileNav.contains(e.target)) {
                mobileNav.classList.remove('open');
                burgerBtn.classList.remove('open');
            }
        });
    }

    /* ---- Smooth scroll for anchor links ---- */
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
        anchor.addEventListener('click', function (e) {
            const target = document.querySelector(this.getAttribute('href'));
            if (!target) return;
            e.preventDefault();
            const headerH = parseInt(getComputedStyle(document.documentElement)
                .getPropertyValue('--header-h')) || 64;
            const top = target.getBoundingClientRect().top + window.scrollY - headerH - 12;
            window.scrollTo({ top: top, behavior: 'smooth' });
        });
    });

    /* ---- Validation helpers ---- */
    function showError(fieldId, errorId, message) {
        const field = document.getElementById(fieldId);
        const error = document.getElementById(errorId);
        if (field)  field.classList.add('hasError');
        if (error)  error.textContent = message;
    }

    function clearError(fieldId, errorId) {
        const field = document.getElementById(fieldId);
        const error = document.getElementById(errorId);
        if (field)  field.classList.remove('hasError');
        if (error)  error.textContent = '';
    }

    function validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    }

    /* ---- Real-time validation on blur ---- */
    function setupRealtimeValidation() {
        const nameField  = document.getElementById('name');
        const emailField = document.getElementById('email');

        if (nameField) {
            nameField.addEventListener('blur', function () {
                if (!this.value.trim()) {
                    showError('name', 'nameError', 'Пожалуйста, введите ваше имя');
                } else {
                    clearError('name', 'nameError');
                }
            });
        }
        if (emailField) {
            emailField.addEventListener('blur', function () {
                if (!this.value.trim()) {
                    showError('email', 'emailError', 'Пожалуйста, введите email');
                } else if (!validateEmail(this.value)) {
                    showError('email', 'emailError', 'Введите корректный адрес электронной почты');
                } else {
                    clearError('email', 'emailError');
                }
            });
        }
    }

    /* ---- Captcha ---- */
    function initCaptcha() {
        const img        = document.getElementById('captchaImg');
        const tokenInput = document.getElementById('captchaToken');
        if (!img || !tokenInput) return;
        const s = Math.random().toString() + Date.now();
        tokenInput.value = s;
        img.src = '/captcha?s=' + encodeURIComponent(s);
    }

    initCaptcha();

    var captchaRefreshBtn = document.getElementById('captchaRefresh');
    if (captchaRefreshBtn) {
        captchaRefreshBtn.addEventListener('click', function () {
            initCaptcha();
            var captchaInputEl = document.getElementById('captchaInput');
            if (captchaInputEl) captchaInputEl.value = '';
            clearError('captchaInput', 'captchaError');
        });
    }

    /* ---- Order form submit ---- */
    const orderForm   = document.getElementById('orderForm');
    const submitBtn   = document.getElementById('submitBtn');
    const successMsg  = document.getElementById('formSuccess');
    const failureMsg  = document.getElementById('formFailure');

    if (orderForm) {
        setupRealtimeValidation();

        orderForm.addEventListener('submit', function (e) {
            e.preventDefault();

            // Clear previous messages
            if (successMsg) successMsg.style.display = 'none';
            if (failureMsg) failureMsg.style.display = 'none';

            const name    = document.getElementById('name');
            const email   = document.getElementById('email');
            const agree   = document.getElementById('agree');

            let valid = true;

            // Name
            clearError('name', 'nameError');
            if (!name || !name.value.trim()) {
                showError('name', 'nameError', 'Пожалуйста, введите ваше имя');
                valid = false;
            }

            // Email
            clearError('email', 'emailError');
            if (!email || !email.value.trim()) {
                showError('email', 'emailError', 'Пожалуйста, введите email');
                valid = false;
            } else if (!validateEmail(email.value)) {
                showError('email', 'emailError', 'Введите корректный адрес электронной почты');
                valid = false;
            }

            // Captcha
            var captchaInputEl = document.getElementById('captchaInput');
            clearError('captchaInput', 'captchaError');
            if (!captchaInputEl || !captchaInputEl.value.trim()) {
                showError('captchaInput', 'captchaError', 'Введите код с картинки');
                valid = false;
            }

            // Agree
            clearError('agree', 'agreeError');
            if (!agree || !agree.checked) {
                showError('agree', 'agreeError', 'Необходимо согласие на обработку персональных данных');
                valid = false;
            }

            if (!valid) {
                // Scroll to first error
                const firstError = orderForm.querySelector('.hasError');
                if (firstError) {
                    const headerH = parseInt(getComputedStyle(document.documentElement)
                        .getPropertyValue('--header-h')) || 64;
                    window.scrollTo({
                        top: firstError.getBoundingClientRect().top + window.scrollY - headerH - 20,
                        behavior: 'smooth'
                    });
                }
                return;
            }

            // Collect form data
            var captchaTokenEl = document.getElementById('captchaToken');
            const formData = {
                name:         name.value.trim(),
                email:        email.value.trim(),
                tariff:       (document.getElementById('tariff')  || {}).value || '',
                message:      (document.getElementById('message') || {}).value || '',
                captchaToken: captchaTokenEl ? captchaTokenEl.value : '',
                captcha:      captchaInputEl ? captchaInputEl.value.trim() : ''
            };

            // Show loading state
            setLoading(true);

            // AJAX request
            fetch('/api/send-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })
            .then(function (res) {
                return res.json().then(function (data) {
                    return { ok: res.ok, data: data };
                });
            })
            .then(function (result) {
                setLoading(false);
                if (result.ok && result.data.success) {
                    orderForm.querySelectorAll('input, select, textarea').forEach(function (el) {
                        el.value = '';
                    });
                    initCaptcha();
                    if (successMsg) successMsg.style.display = 'block';
                    successMsg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                } else if (result.data && (result.data.captchaWrong || result.data.captchaExpired)) {
                    initCaptcha();
                    var captchaInputEl2 = document.getElementById('captchaInput');
                    if (captchaInputEl2) captchaInputEl2.value = '';
                    showError('captchaInput', 'captchaError', result.data.error || 'Неверный код с картинки');
                } else {
                    if (failureMsg) failureMsg.style.display = 'block';
                }
            })
            .catch(function () {
                setLoading(false);
                if (failureMsg) failureMsg.style.display = 'block';
            });
        });
    }

    function setLoading(loading) {
        if (!submitBtn) return;
        const textEl   = submitBtn.querySelector('.submitBtnText');
        const loaderEl = submitBtn.querySelector('.submitBtnLoader');
        submitBtn.disabled = loading;
        if (textEl)   textEl.style.display   = loading ? 'none' : '';
        if (loaderEl) loaderEl.style.display = loading ? '' : 'none';
    }

    /* ---- "Заказать" buttons on tariff cards: pre-fill tariff select ---- */
    document.querySelectorAll('.tariff-order-btn, .title.tdu').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            const tariffName = this.getAttribute('data-tariff');
            if (!tariffName) return;
            const select = document.getElementById('tariff');
            if (select) {
                for (var i = 0; i < select.options.length; i++) {
                    if (select.options[i].value === tariffName) {
                        select.selectedIndex = i;
                        break;
                    }
                }
            }
        });
    });

    /* ---- Subscribe form ---- */
    const subscribeForm = document.getElementById('subscribeForm');
    const subscribeMsg  = document.getElementById('subscribeMsg');

    if (subscribeForm) {
        subscribeForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const agreeEl = document.getElementById('subscribeAgree');
            const emailEl = document.getElementById('subEmail');

            if (!agreeEl || !agreeEl.checked) {
                if (subscribeMsg) subscribeMsg.textContent = 'Дайте согласие на обработку данных';
                return;
            }
            if (!emailEl || !validateEmail(emailEl.value)) {
                if (subscribeMsg) subscribeMsg.textContent = 'Введите корректный e-mail';
                return;
            }

            if (subscribeMsg) subscribeMsg.textContent = 'Отправляем…';

            fetch('/api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: emailEl.value.trim() })
            })
            .then(function (res) { return res.json(); })
            .then(function (data) {
                if (data.success) {
                    if (subscribeMsg) subscribeMsg.textContent = '✓ Вы успешно подписаны!';
                    emailEl.value = '';
                } else {
                    if (subscribeMsg) subscribeMsg.textContent = '⚠ Ошибка. Попробуйте позже.';
                }
            })
            .catch(function () {
                if (subscribeMsg) subscribeMsg.textContent = '⚠ Ошибка. Попробуйте позже.';
            });
        });
    }

    /* ---- Info modal (Остатки не сгорают) ---- */
    const infoModal = document.getElementById('infoModal');
    if (infoModal) {
        const closeModal = () => {
            infoModal.classList.remove('open');
            infoModal.setAttribute('aria-hidden', 'true');
        };
        const openModal = () => {
            infoModal.classList.add('open');
            infoModal.setAttribute('aria-hidden', 'false');
        };
        document.querySelectorAll('.icon-info-v').forEach(function (icon) {
            icon.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                openModal();
            });
        });
        infoModal.addEventListener('click', function (e) {
            if (e.target === infoModal || e.target.classList.contains('modalClose')) closeModal();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && infoModal.classList.contains('open')) closeModal();
        });
    }

})();
