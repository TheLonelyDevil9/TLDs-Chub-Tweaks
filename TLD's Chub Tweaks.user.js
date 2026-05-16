// ==UserScript==
// @name         TLD's Chub Tweaks
// @namespace    https://chub.ai
// @version      5.5.21
// @updateURL    https://github.com/TheLonelyDevil9/TLDs-Chub-Tweaks/raw/refs/heads/main/TLD%27s%20Chub%20Tweaks.user.js
// @downloadURL  https://github.com/TheLonelyDevil9/TLDs-Chub-Tweaks/raw/refs/heads/main/TLD%27s%20Chub%20Tweaks.user.js
// @description  Adds creator-page all-cards sorting/view-all while keeping Chub's native look, plus card-page auto-expand, editor jump shortcuts, top-right action buttons, reliable gallery multi-upload, and a brighter unread notification bell
// @author       The_Lonely_Devil
// @match        https://chub.ai/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_KEY = 'chub-sort-preference';

  const SERVER_SORTS = [
    { value: 'created_at', label: 'Creation Time' },
    { value: 'n_favorites', label: '# Favorited' },
    { value: 'rating', label: 'Rating' },
    { value: 'name', label: 'Name' },
    { value: 'n_tokens', label: '# Tokens' },
    { value: 'n_ratings', label: '# Ratings' },
  ];

  const CLIENT_SORTS = [
    { value: 'starCount', label: '# Downloads' },
    { value: 'nMessages', label: '# Messages' },
    { value: 'nChats', label: '# Chats' },
    { value: 'n_public_chats', label: '# Public Chats' },
    { value: 'lastActivityAt', label: 'Last Activity' },
  ];

  const ALL_SORTS = [...SERVER_SORTS, ...CLIENT_SORTS];
  const CLIENT_SORT_KEYS = new Set(CLIENT_SORTS.map(s => s.value));
  const CUSTOM_GRID_SELECTOR = '[data-chub-sort-grid]';
  const TOOLBAR_SELECTOR = '[data-chub-sort-toolbar]';
  const STYLE_ID = 'chub-sort-style';
  const PORTAL_TOP_LAYER_STYLE_ID = 'chub-portal-top-layer-style';
  const NOTIFICATION_STYLE_ID = 'chub-notification-bell-style';
  const PROFILE_WIDTH_STYLE_ID = 'chub-profile-width-style';
  const PROFILE_WIDTH_ATTR = 'data-chub-profile-wide';
  const PROFILE_WIDTH_CONTAINER_ATTR = 'data-chub-profile-wide-container';
  const PROFILE_WIDTH_TARGET_ATTR = 'data-chub-profile-wide-target';
  const EDITOR_WIDTH_STYLE_ID = 'chub-editor-width-style';
  const EDITOR_WIDTH_ATTR = 'data-chub-editor-wide';
  const EDITOR_WIDTH_CONTAINER_ATTR = 'data-chub-editor-wide-container';
  const NOTIFICATION_BELL_ATTR = 'data-chub-notification-bell';
  const NOTIFICATION_UNREAD_ATTR = 'data-chub-notification-unread';
  const NOTIFICATION_SYNC_INTERVAL_MS = 1800;
  const ROUTE_WIDTH_RETRY_DELAYS_MS = [0, 120, 360, 900, 1800];
  const CHARACTER_SECTIONS_TO_EXPAND = ['Definitions', 'Discussion', 'Gallery'];
  const GALLERY_INPUT_SELECTOR = 'input[type="file"][accept="image/*"][name="file"]';
  const CHARACTER_ACTION_BAR_SELECTOR = 'div.flex.flex-wrap.justify-end';
  const HEADER_SELECTOR = '.ant-layout-header';
  const MOBILE_ACTION_BREAKPOINT = 640;
  const CHARACTER_ACTION_DOCK_ATTR = 'data-chub-action-docked';
  const GALLERY_REVIEW_BUTTON_ATTR = 'data-chub-gallery-review-button';
  const GALLERY_REVIEW_ROW_ATTR = 'data-chub-gallery-review-row';
  const GALLERY_REVIEW_ITEM_ATTR = 'data-chub-gallery-review-item';
  const GALLERY_REVIEW_COLLAPSE_SECTIONS = ['Definitions', 'Discussion'];
  const GALLERY_REVIEW_EXPAND_LABELS = [
    'show more', 'view more', 'load more', 'see more', 'show all', 'view all', 'expand', 'more',
  ];
  const GALLERY_REVIEW_SKIP_LABELS = [
    'upload', 'add', 'delete', 'remove', 'edit', 'report', 'favorite', 'fork',
  ];
  const EDITOR_JUMP_DOCK_ATTR = 'data-chub-editor-jump-dock';
  const EDITOR_JUMP_BUTTON_ATTR = 'data-chub-editor-jump-button';
  const EDITOR_ADVANCED_SECTION = 'Advanced Definitions';
  const EDITOR_JUMP_BUTTONS = [
    { action: 'ag0', label: 'Jump to AGs', title: 'Jump to Advanced Definitions first alternate greeting' },
    { action: 'top', label: 'Jump to Top', title: 'Jump to Name or Avatar at the top of the editor' },
    { action: 'initial', label: 'Jump to AG0', title: 'Jump to Initial Message' },
  ];
  const TOOLBAR_SURFACE = '#000000';
  const TOOLBAR_TEXT = '#ff8a00';
  const TOOLBAR_BORDER = 'rgba(255, 138, 0, 0.72)';

  function loadPrefs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { sort: 'created_at', direction: 'desc' };
      const p = JSON.parse(raw);
      return { sort: p.sort || 'created_at', direction: p.direction || 'desc' };
    } catch { return { sort: 'created_at', direction: 'desc' }; }
  }

  function savePrefs(sort, direction) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ sort, direction })); } catch {}
  }

  function isCreatorPage() {
    return /^\/users\/[^/]+\/?$/.test(location.pathname);
  }

  function isCharacterPage() {
    return location.pathname.startsWith('/characters/');
  }

  function isEditorPage() {
    return /^\/edit\/[^/]+\/[^/]+\/?$/.test(location.pathname);
  }

  function isProfilePage() {
    return /^\/profile\/?$/.test(location.pathname);
  }

  function getCreatorUsername() {
    const m = location.pathname.match(/^\/users\/([^/]+)/);
    return m ? m[1] : null;
  }

  function getRouteKey() {
    return `${location.pathname}${location.search}`;
  }

  function normalizeText(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
  }

  function hideRecommendedSection() {
    for (const heading of document.querySelectorAll('h4.ant-typography')) {
      if (heading.textContent.trim() !== 'You May Also Like') continue;

      const container = heading.closest('.ant-card, section, article') || heading.parentElement;
      if (container) {
        container.style.display = 'none';
      }
    }
  }

  function getCollapseItemTitle(item) {
    return normalizeText(item?.querySelector('.ant-collapse-header-text')?.textContent) || '';
  }

  function setCollapseItemExpanded(item, shouldBeExpanded) {
    if (!item) return false;

    const isExpanded = item.classList.contains('ant-collapse-item-active');
    if (isExpanded === shouldBeExpanded) return false;

    item.querySelector('.ant-collapse-header')?.click();
    return true;
  }

  function findCharacterCollapseItem(sectionName) {
    for (const item of document.querySelectorAll('.ant-collapse-item')) {
      if (getCollapseItemTitle(item).startsWith(sectionName)) {
        return item;
      }
    }

    return null;
  }

  function expandCharacterSections() {
    if (galleryReviewRouteKey === getRouteKey()) return;

    for (const item of document.querySelectorAll('.ant-collapse-item')) {
      const text = getCollapseItemTitle(item);
      const shouldExpand = CHARACTER_SECTIONS_TO_EXPAND.some(section => text.startsWith(section));
      if (!shouldExpand) continue;

      setCollapseItemExpanded(item, true);
    }
  }

  function isGalleryReviewActive() {
    return galleryReviewRouteKey === getRouteKey();
  }

  function isSafeGalleryExpandControl(element) {
    if (!element || !isVisibleElement(element)) return false;
    if (element.closest('.ant-upload')) return false;

    const label = getButtonLabel(element).toLowerCase();
    if (!label) return false;
    if (GALLERY_REVIEW_SKIP_LABELS.some(skip => label.includes(skip))) return false;

    return GALLERY_REVIEW_EXPAND_LABELS.some(expandLabel => label.includes(expandLabel));
  }

  function expandGalleryArtwork(galleryItem) {
    if (!galleryItem) return;

    const content = galleryItem.querySelector('.ant-collapse-content, .ant-collapse-content-box') || galleryItem;
    const controls = [
      ...content.querySelectorAll('button, a, [role="button"], .ant-image-mask, .ant-image'),
    ];

    for (const control of controls) {
      if (!isSafeGalleryExpandControl(control)) continue;
      control.click();
    }

    for (const details of content.querySelectorAll('details')) {
      details.open = true;
    }
  }

  function runGalleryReview() {
    if (!isCharacterPage() || !isGalleryReviewActive()) return;

    for (const section of GALLERY_REVIEW_COLLAPSE_SECTIONS) {
      setCollapseItemExpanded(findCharacterCollapseItem(section), false);
    }

    const galleryItem = findCharacterCollapseItem('Gallery');
    if (!galleryItem) return;

    galleryItem.setAttribute(GALLERY_REVIEW_ITEM_ATTR, 'true');
    setCollapseItemExpanded(galleryItem, true);
    expandGalleryArtwork(galleryItem);

    if (galleryReviewScrolledRouteKey !== getRouteKey()) {
      galleryReviewScrolledRouteKey = getRouteKey();
      requestAnimationFrame(() => {
        galleryItem.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
    }
  }

  function startGalleryReview() {
    galleryReviewRouteKey = getRouteKey();
    galleryReviewScrolledRouteKey = null;
    updateGalleryReviewButtonState();
    runGalleryReview();
    setTimeout(runGalleryReview, 250);
    setTimeout(runGalleryReview, 900);
    setTimeout(runGalleryReview, 1800);
  }

  function stopGalleryReview() {
    galleryReviewRouteKey = null;
    galleryReviewScrolledRouteKey = null;

    for (const item of document.querySelectorAll(`[${GALLERY_REVIEW_ITEM_ATTR}="true"]`)) {
      item.removeAttribute(GALLERY_REVIEW_ITEM_ATTR);
    }

    expandCharacterSections();
    updateGalleryReviewButtonState();
  }

  function toggleGalleryReview() {
    if (isGalleryReviewActive()) {
      stopGalleryReview();
      return;
    }

    startGalleryReview();
  }

  function isGalleryUploadInput(input) {
    const collapseItem = input.closest('.ant-collapse-item');
    const headerText = collapseItem?.querySelector('.ant-collapse-header-text')?.textContent?.trim() || '';
    return headerText.startsWith('Gallery');
  }

  function enableGalleryMultiUpload() {
    for (const input of document.querySelectorAll(GALLERY_INPUT_SELECTOR)) {
      if (!isGalleryUploadInput(input)) continue;

      input.multiple = true;
      input.setAttribute('multiple', '');
      input.dataset.chubMultiUpload = 'true';
    }
  }

  function openGalleryPicker(input) {
    if (!input) return;

    // Clearing the value lets you pick the same file(s) again if needed.
    input.value = '';
    input.click();
  }

  function installGalleryUploadFallbacks() {
    for (const input of document.querySelectorAll(GALLERY_INPUT_SELECTOR)) {
      if (!isGalleryUploadInput(input)) continue;

      const uploadRoot = input.closest('.ant-upload');
      const tile = uploadRoot?.querySelector('.mx-2') || uploadRoot;
      if (!tile) continue;

      tile.style.cursor = 'pointer';
      tile.setAttribute('role', 'button');
      tile.setAttribute('tabindex', '0');
      tile.setAttribute('title', 'Select one or more images to upload');

      if (tile.dataset.chubUploadFallback === 'true') continue;

      tile.dataset.chubUploadFallback = 'true';

      tile.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        openGalleryPicker(input);
      }, true);

      tile.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;

        event.preventDefault();
        event.stopPropagation();
        openGalleryPicker(input);
      });
    }
  }

  function isVisibleElement(element) {
    if (!element || !element.isConnected) return false;

    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return false;

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function getButtonLabel(element) {
    return normalizeText(element?.textContent);
  }

  function setAttributeIfChanged(element, attr, value) {
    if (!element || element.getAttribute(attr) === value) return;
    element.setAttribute(attr, value);
  }

  function ensureStyleElement(styleId) {
    if (!document.head) return null;

    let style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }

    return style;
  }

  function ensurePortalTopLayerStyle() {
    const styleText = `
      .ant-dropdown:not(.ant-dropdown-hidden),
      .ant-select-dropdown:not(.ant-select-dropdown-hidden),
      .ant-popover,
      .ant-menu-submenu-popup,
      .ant-tooltip {
        z-index: 2147483647 !important;
        pointer-events: auto !important;
      }

      .ant-dropdown:not(.ant-dropdown-hidden) *,
      .ant-select-dropdown:not(.ant-select-dropdown-hidden) *,
      .ant-popover *,
      .ant-menu-submenu-popup *,
      .ant-tooltip * {
        pointer-events: auto !important;
      }
    `;

    let style = document.getElementById(PORTAL_TOP_LAYER_STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = PORTAL_TOP_LAYER_STYLE_ID;
      document.head.appendChild(style);
    }
    if (style.textContent !== styleText) {
      style.textContent = styleText;
    }
  }

  function ensureNotificationBellStyle() {
    const styleText = `
      ${HEADER_SELECTOR} [${NOTIFICATION_BELL_ATTR}="true"] {
        --chub-notification-hot: #fff176;
        --chub-notification-core: #fff8bf;
        --chub-notification-glow: rgba(255, 230, 74, 0.92);
        --chub-notification-warm-glow: rgba(255, 138, 0, 0.58);
        border-radius: 999px !important;
        isolation: isolate !important;
        position: relative !important;
      }
      ${HEADER_SELECTOR} [${NOTIFICATION_BELL_ATTR}="true"] :is(.anticon, svg, [class*="bell" i]) {
        transition:
          color 160ms ease,
          filter 160ms ease,
          opacity 160ms ease,
          transform 160ms ease !important;
      }
      ${HEADER_SELECTOR} [${NOTIFICATION_BELL_ATTR}="true"][${NOTIFICATION_UNREAD_ATTR}="true"] {
        color: var(--chub-notification-core) !important;
        text-shadow:
          0 0 8px var(--chub-notification-glow),
          0 0 18px var(--chub-notification-warm-glow) !important;
      }
      ${HEADER_SELECTOR} [${NOTIFICATION_BELL_ATTR}="true"][${NOTIFICATION_UNREAD_ATTR}="true"]::before {
        animation: chub-notification-bell-pulse 1.75s ease-out infinite;
        background:
          radial-gradient(circle, rgba(255, 248, 191, 0.48) 0%, rgba(255, 230, 74, 0.25) 38%, rgba(255, 138, 0, 0.14) 58%, transparent 76%);
        border-radius: 999px;
        box-shadow:
          0 0 12px 3px var(--chub-notification-glow),
          0 0 30px 7px var(--chub-notification-warm-glow);
        content: "";
        inset: -8px;
        pointer-events: none;
        position: absolute;
        z-index: -1;
      }
      ${HEADER_SELECTOR} [${NOTIFICATION_BELL_ATTR}="true"][${NOTIFICATION_UNREAD_ATTR}="true"] :is(.anticon, svg, [class*="bell" i]) {
        color: var(--chub-notification-hot) !important;
        filter:
          drop-shadow(0 0 4px rgba(255, 248, 191, 1))
          drop-shadow(0 0 10px var(--chub-notification-glow))
          drop-shadow(0 0 18px var(--chub-notification-warm-glow)) !important;
        opacity: 1 !important;
        transform: translateY(-1px) scale(1.08);
      }
      ${HEADER_SELECTOR} [${NOTIFICATION_BELL_ATTR}="true"][${NOTIFICATION_UNREAD_ATTR}="true"] :is(.ant-badge-count, .ant-scroll-number, .ant-badge-dot) {
        background: var(--chub-notification-hot) !important;
        color: #1f1100 !important;
        box-shadow:
          0 0 0 1px rgba(31, 17, 0, 0.82),
          0 0 9px 2px var(--chub-notification-glow),
          0 0 18px 4px var(--chub-notification-warm-glow) !important;
        font-weight: 900 !important;
      }
      ${HEADER_SELECTOR} [${NOTIFICATION_BELL_ATTR}="true"][${NOTIFICATION_UNREAD_ATTR}="true"] .ant-badge-dot {
        height: 9px !important;
        min-width: 9px !important;
        width: 9px !important;
      }
      @keyframes chub-notification-bell-pulse {
        0%, 100% { opacity: 0.82; transform: scale(0.96); }
        48% { opacity: 1; transform: scale(1.1); }
      }
      @media (prefers-reduced-motion: reduce) {
        ${HEADER_SELECTOR} [${NOTIFICATION_BELL_ATTR}="true"][${NOTIFICATION_UNREAD_ATTR}="true"]::before {
          animation: none !important;
        }
        ${HEADER_SELECTOR} [${NOTIFICATION_BELL_ATTR}="true"][${NOTIFICATION_UNREAD_ATTR}="true"] :is(.anticon, svg, [class*="bell" i]) {
          transform: none !important;
        }
      }
    `;

    let style = document.getElementById(NOTIFICATION_STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = NOTIFICATION_STYLE_ID;
      document.head.appendChild(style);
    }
    if (style.textContent !== styleText) {
      style.textContent = styleText;
    }
  }

  function setProfileWidthAttr() {
    if (!document.documentElement) return;

    if (isProfilePage()) {
      document.documentElement.setAttribute(PROFILE_WIDTH_ATTR, 'true');
    } else {
      document.documentElement.removeAttribute(PROFILE_WIDTH_ATTR);
    }
  }

  function setEditorWidthAttr() {
    if (!document.documentElement) return;

    if (isEditorPage()) {
      document.documentElement.setAttribute(EDITOR_WIDTH_ATTR, 'true');
    } else {
      document.documentElement.removeAttribute(EDITOR_WIDTH_ATTR);
    }
  }

  function updateBooleanAttribute(element, attr, shouldSet) {
    if (!element) return;

    if (shouldSet) {
      setAttributeIfChanged(element, attr, 'true');
    } else {
      element.removeAttribute(attr);
    }
  }

  function isWideRouteForm(form) {
    if (!(form instanceof HTMLElement) || !form.matches('form')) return false;
    if (form.matches('.ant-form-horizontal, .ant-form')) return true;

    return !!form.querySelector(
      '.ant-form-item, .ant-form-item-row, .ant-form-item-control, .ant-input, .ant-select, textarea, input:not([type="hidden"])',
    );
  }

  function findWideRouteForms(isActive) {
    if (!isActive) return [];

    const antForms = [...document.querySelectorAll('form.ant-form-horizontal, form.ant-form')]
      .filter(isWideRouteForm);
    if (antForms.length) return antForms;

    return [...document.querySelectorAll('form')].filter(isWideRouteForm);
  }

  function collectWideContainerChain(form) {
    const containers = new Set();

    for (let node = form, depth = 0; node && node !== document.body && depth < 8; node = node.parentElement, depth += 1) {
      if (node instanceof HTMLElement) {
        containers.add(node);
      }
      if (node.matches?.('main, .ant-layout-content')) break;
    }

    const main = form?.closest('main');
    const layoutContent = form?.closest('.ant-layout-content');
    if (main instanceof HTMLElement) containers.add(main);
    if (layoutContent instanceof HTMLElement) containers.add(layoutContent);

    return containers;
  }

  function markRouteWidthContainers({ isActive, attr }) {
    const containers = new Set();

    for (const form of findWideRouteForms(isActive)) {
      for (const container of collectWideContainerChain(form)) {
        containers.add(container);
      }
    }

    for (const container of document.querySelectorAll(`[${attr}="true"]`)) {
      if (!containers.has(container)) {
        container.removeAttribute(attr);
      }
    }

    for (const container of containers) {
      updateBooleanAttribute(container, attr, true);
    }
  }

  function markProfileWideContainers() {
    markRouteWidthContainers({
      isActive: isProfilePage(),
      attr: PROFILE_WIDTH_CONTAINER_ATTR,
    });
  }

  function markEditorWideContainers() {
    markRouteWidthContainers({
      isActive: isEditorPage(),
      attr: EDITOR_WIDTH_CONTAINER_ATTR,
    });
  }

  function markProfileWideTargets() {
    const existingTargets = document.querySelectorAll(`[${PROFILE_WIDTH_TARGET_ATTR}="true"]`);
    if (!isProfilePage()) {
      for (const target of existingTargets) {
        target.removeAttribute(PROFILE_WIDTH_TARGET_ATTR);
      }
      return;
    }

    for (const button of document.querySelectorAll(`button[${PROFILE_WIDTH_TARGET_ATTR}="true"]`)) {
      button.removeAttribute(PROFILE_WIDTH_TARGET_ATTR);
    }

    for (const button of document.querySelectorAll(`form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] button`)) {
      if (!isVisibleElement(button) || button.closest('.ant-collapse')) continue;

      const rect = button.getBoundingClientRect();
      const parentRect = button.parentElement?.getBoundingClientRect();
      const isAlreadyBlockButton = button.classList.contains('ant-btn-block')
        || !parentRect
        || rect.width >= parentRect.width * 0.82;

      if (isAlreadyBlockButton) {
        button.setAttribute(PROFILE_WIDTH_TARGET_ATTR, 'true');
      }
    }
  }

  function ensureProfileWidthStyle() {
    const style = ensureStyleElement(PROFILE_WIDTH_STYLE_ID);
    if (!style) return;

    const styleText = `
      html[${PROFILE_WIDTH_ATTR}="true"] {
        --chub-profile-shell-width: min(1240px, calc(100vw - 96px));
        --chub-profile-row-width: min(1040px, calc(100vw - 96px));
        --chub-profile-label-width: 220px;
        --chub-profile-control-width: 820px;
        overflow-x: hidden !important;
      }

      html[${PROFILE_WIDTH_ATTR}="true"] body {
        overflow-x: hidden !important;
      }

      html[${PROFILE_WIDTH_ATTR}="true"] [${PROFILE_WIDTH_CONTAINER_ATTR}="true"],
      html[${PROFILE_WIDTH_ATTR}="true"] form.ant-form-horizontal[${PROFILE_WIDTH_CONTAINER_ATTR}="true"],
      html[${PROFILE_WIDTH_ATTR}="true"] form.ant-form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"],
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] {
        align-self: center !important;
        box-sizing: border-box !important;
        flex: 0 1 var(--chub-profile-shell-width) !important;
        margin-left: auto !important;
        margin-right: auto !important;
        max-width: var(--chub-profile-shell-width) !important;
        min-width: 0 !important;
        overflow-x: hidden !important;
        width: var(--chub-profile-shell-width) !important;
      }

      html[${PROFILE_WIDTH_ATTR}="true"] [${PROFILE_WIDTH_CONTAINER_ATTR}="true"] *,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] * {
        box-sizing: border-box !important;
      }

      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] > *,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item {
        margin-left: auto !important;
        margin-right: auto !important;
        max-width: var(--chub-profile-row-width) !important;
        min-width: 0 !important;
        overflow-wrap: anywhere !important;
        width: var(--chub-profile-row-width) !important;
      }

      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > .ant-row {
        column-gap: 0 !important;
        display: grid !important;
        grid-template-columns: 220px minmax(0, 820px) !important;
        justify-content: center !important;
        max-width: none !important;
        min-width: 0 !important;
        overflow-x: hidden !important;
        overflow-wrap: anywhere !important;
        row-gap: 6px !important;
        width: 100% !important;
      }

      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row > .ant-col,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row > [class*="ant-col-"],
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > .ant-col,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > [class*="ant-col-"] {
        flex: none !important;
        margin-left: 0 !important;
        max-width: none !important;
        min-width: 0 !important;
        width: auto !important;
      }

      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row > .ant-form-item-label,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row > .ant-col.ant-form-item-label,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row > [class*="ant-col-"].ant-form-item-label,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > .ant-form-item-label,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > .ant-col.ant-form-item-label,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > [class*="ant-col-"].ant-form-item-label {
        flex: none !important;
        grid-column: 1 !important;
        max-width: var(--chub-profile-label-width) !important;
        min-width: 0 !important;
        text-align: right !important;
        width: var(--chub-profile-label-width) !important;
      }

      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-label > label {
        height: auto !important;
        white-space: normal !important;
      }

      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row > .ant-form-item-control,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row > .ant-col.ant-form-item-control,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row > [class*="ant-col-"].ant-form-item-control,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > .ant-form-item-control,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > .ant-col.ant-form-item-control,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > [class*="ant-col-"].ant-form-item-control {
        flex: none !important;
        grid-column: 2 !important;
        justify-self: stretch !important;
        margin-left: 0 !important;
        max-width: var(--chub-profile-control-width) !important;
        min-width: 0 !important;
        width: var(--chub-profile-control-width) !important;
      }

      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-control-input,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-control-input-content,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-input-group-wrapper,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-input-group,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-input-affix-wrapper,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-input-number,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-input-number-group-wrapper,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-picker,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-mentions,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-select,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-select-selector,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-select-selection-overflow,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-select-selection-item,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-select-selection-placeholder,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-select-selection-search,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-select-selection-search-input,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-tree-select,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-cascader-picker,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-radio-group,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-checkbox-group,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-space,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-space-item,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-upload-wrapper,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-upload,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-upload-list,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-input,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-input-number-input,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="hidden"]),
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] select,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] textarea {
        max-width: none !important;
        min-width: 0 !important;
        overflow-wrap: anywhere !important;
        width: 100% !important;
      }

      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] textarea {
        resize: vertical !important;
      }

      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] button[${PROFILE_WIDTH_TARGET_ATTR}="true"] {
        margin-left: auto !important;
        margin-right: auto !important;
        max-width: min(var(--chub-profile-control-width), 100%) !important;
        min-width: 0 !important;
        width: min(var(--chub-profile-control-width), 100%) !important;
      }

      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] > .ant-collapse,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-collapse {
        margin-left: auto !important;
        margin-right: auto !important;
        max-width: var(--chub-profile-row-width) !important;
        min-width: 0 !important;
        width: var(--chub-profile-row-width) !important;
      }

      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-collapse .ant-form-item,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-collapse .ant-row,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-collapse .ant-form-item-row,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-collapse .ant-collapse-content,
      html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-collapse .ant-collapse-content-box {
        max-width: 100% !important;
        min-width: 0 !important;
        width: 100% !important;
      }

      @media (max-width: 1135px) {
        html[${PROFILE_WIDTH_ATTR}="true"] {
          --chub-profile-shell-width: calc(100vw - 48px);
          --chub-profile-row-width: calc(100vw - 48px);
          --chub-profile-label-width: clamp(150px, 28vw, 220px);
          --chub-profile-control-width: 100%;
        }

        html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row,
        html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > .ant-row {
          grid-template-columns: minmax(150px, var(--chub-profile-label-width)) minmax(0, 1fr) !important;
        }

        html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row > .ant-form-item-control,
        html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row > .ant-col.ant-form-item-control,
        html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row > [class*="ant-col-"].ant-form-item-control,
        html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > .ant-form-item-control,
        html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > .ant-col.ant-form-item-control,
        html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > [class*="ant-col-"].ant-form-item-control {
          max-width: 100% !important;
          width: 100% !important;
        }
      }

      @media (max-width: 760px) {
        html[${PROFILE_WIDTH_ATTR}="true"] {
          --chub-profile-shell-width: calc(100vw - 24px);
          --chub-profile-row-width: calc(100vw - 24px);
          --chub-profile-label-width: 100%;
          --chub-profile-control-width: 100%;
        }

        html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row,
        html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > .ant-row {
          display: block !important;
        }

        html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row > .ant-form-item-label,
        html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row > .ant-col.ant-form-item-label,
        html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row > [class*="ant-col-"].ant-form-item-label,
        html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > .ant-form-item-label,
        html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > .ant-col.ant-form-item-label,
        html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > [class*="ant-col-"].ant-form-item-label {
          max-width: 100% !important;
          text-align: left !important;
          width: 100% !important;
        }

        html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row > .ant-form-item-control,
        html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row > .ant-col.ant-form-item-control,
        html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row > [class*="ant-col-"].ant-form-item-control,
        html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > .ant-form-item-control,
        html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > .ant-col.ant-form-item-control,
        html[${PROFILE_WIDTH_ATTR}="true"] form[${PROFILE_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > [class*="ant-col-"].ant-form-item-control {
          max-width: 100% !important;
          width: 100% !important;
        }
      }
    `;

    if (style.textContent !== styleText) {
      style.textContent = styleText;
    }
  }

  function ensureEditorWidthStyle() {
    const style = ensureStyleElement(EDITOR_WIDTH_STYLE_ID);
    if (!style) return;

    const styleText = `
      html[${EDITOR_WIDTH_ATTR}="true"] {
        --chub-editor-shell-width: min(1240px, calc(100vw - 96px));
        --chub-editor-row-width: min(1060px, calc(100vw - 96px));
        --chub-editor-label-width: 220px;
        --chub-editor-control-width: 840px;
        overflow-x: hidden !important;
      }

      html[${EDITOR_WIDTH_ATTR}="true"] body {
        overflow-x: hidden !important;
      }

      html[${EDITOR_WIDTH_ATTR}="true"] [${EDITOR_WIDTH_CONTAINER_ATTR}="true"],
      html[${EDITOR_WIDTH_ATTR}="true"] form.ant-form-horizontal[${EDITOR_WIDTH_CONTAINER_ATTR}="true"],
      html[${EDITOR_WIDTH_ATTR}="true"] form.ant-form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"],
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] {
        align-self: center !important;
        box-sizing: border-box !important;
        flex: 0 1 var(--chub-editor-shell-width) !important;
        margin-left: auto !important;
        margin-right: auto !important;
        max-width: var(--chub-editor-shell-width) !important;
        min-width: 0 !important;
        overflow-x: hidden !important;
        width: var(--chub-editor-shell-width) !important;
      }

      html[${EDITOR_WIDTH_ATTR}="true"] [${EDITOR_WIDTH_CONTAINER_ATTR}="true"] *,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] * {
        box-sizing: border-box !important;
      }

      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] > *,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-collapse,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-collapse-item,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-collapse-content,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-collapse-content-box {
        margin-left: auto !important;
        margin-right: auto !important;
        max-width: var(--chub-editor-row-width) !important;
        min-width: 0 !important;
        overflow-wrap: anywhere !important;
        width: var(--chub-editor-row-width) !important;
      }

      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > .ant-row {
        column-gap: 0 !important;
        display: grid !important;
        grid-template-columns: 220px minmax(0, 840px) !important;
        justify-content: center !important;
        max-width: none !important;
        min-width: 0 !important;
        overflow-x: hidden !important;
        overflow-wrap: anywhere !important;
        row-gap: 6px !important;
        width: 100% !important;
      }

      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row > .ant-col,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row > [class*="ant-col-"],
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > .ant-col,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > [class*="ant-col-"] {
        flex: none !important;
        margin-left: 0 !important;
        max-width: none !important;
        min-width: 0 !important;
        width: auto !important;
      }

      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row > .ant-form-item-label,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row > .ant-col.ant-form-item-label,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row > [class*="ant-col-"].ant-form-item-label,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > .ant-form-item-label,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > .ant-col.ant-form-item-label,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > [class*="ant-col-"].ant-form-item-label {
        flex: none !important;
        grid-column: 1 !important;
        max-width: var(--chub-editor-label-width) !important;
        min-width: 0 !important;
        text-align: right !important;
        width: var(--chub-editor-label-width) !important;
      }

      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-label > label {
        height: auto !important;
        white-space: normal !important;
      }

      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row > .ant-form-item-control,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row > .ant-col.ant-form-item-control,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row > [class*="ant-col-"].ant-form-item-control,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > .ant-form-item-control,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > .ant-col.ant-form-item-control,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > [class*="ant-col-"].ant-form-item-control {
        flex: none !important;
        grid-column: 2 !important;
        justify-self: stretch !important;
        margin-left: 0 !important;
        max-width: var(--chub-editor-control-width) !important;
        min-width: 0 !important;
        width: var(--chub-editor-control-width) !important;
      }

      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-control-input,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-control-input-content,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-input-group-wrapper,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-input-group,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-input-affix-wrapper,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-input-number,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-input-number-group-wrapper,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-picker,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-mentions,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-select,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-select-selector,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-select-selection-overflow,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-select-selection-item,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-select-selection-placeholder,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-select-selection-search,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-select-selection-search-input,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-tree-select,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-cascader-picker,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-radio-group,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-checkbox-group,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-space,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-space-item,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-upload-wrapper,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-upload,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-upload-list,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-input,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-input-number-input,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="hidden"]),
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] select,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] textarea {
        max-width: none !important;
        min-width: 0 !important;
        overflow-wrap: anywhere !important;
        width: 100% !important;
      }

      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] textarea {
        resize: vertical !important;
      }

      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] > .ant-collapse,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-collapse {
        margin-left: auto !important;
        margin-right: auto !important;
        max-width: var(--chub-editor-row-width) !important;
        min-width: 0 !important;
        width: var(--chub-editor-row-width) !important;
      }

      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-collapse .ant-form-item,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-collapse .ant-row,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-collapse .ant-form-item-row,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-collapse .ant-collapse-content,
      html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-collapse .ant-collapse-content-box {
        max-width: 100% !important;
        min-width: 0 !important;
        width: 100% !important;
      }

      @media (max-width: 1155px) {
        html[${EDITOR_WIDTH_ATTR}="true"] {
          --chub-editor-shell-width: calc(100vw - 48px);
          --chub-editor-row-width: calc(100vw - 48px);
          --chub-editor-label-width: clamp(150px, 28vw, 220px);
          --chub-editor-control-width: 100%;
        }

        html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row,
        html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > .ant-row {
          grid-template-columns: minmax(150px, var(--chub-editor-label-width)) minmax(0, 1fr) !important;
        }

        html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row > .ant-form-item-control,
        html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row > .ant-col.ant-form-item-control,
        html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row > [class*="ant-col-"].ant-form-item-control,
        html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > .ant-form-item-control,
        html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > .ant-col.ant-form-item-control,
        html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > [class*="ant-col-"].ant-form-item-control {
          max-width: 100% !important;
          width: 100% !important;
        }
      }

      @media (max-width: 760px) {
        html[${EDITOR_WIDTH_ATTR}="true"] {
          --chub-editor-shell-width: calc(100vw - 24px);
          --chub-editor-row-width: calc(100vw - 24px);
          --chub-editor-label-width: 100%;
          --chub-editor-control-width: 100%;
        }

        html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row,
        html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > .ant-row {
          display: block !important;
        }

        html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row > .ant-form-item-label,
        html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row > .ant-col.ant-form-item-label,
        html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row > [class*="ant-col-"].ant-form-item-label,
        html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > .ant-form-item-label,
        html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > .ant-col.ant-form-item-label,
        html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > [class*="ant-col-"].ant-form-item-label {
          max-width: 100% !important;
          text-align: left !important;
          width: 100% !important;
        }

        html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row > .ant-form-item-control,
        html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row > .ant-col.ant-form-item-control,
        html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item-row > [class*="ant-col-"].ant-form-item-control,
        html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > .ant-form-item-control,
        html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > .ant-col.ant-form-item-control,
        html[${EDITOR_WIDTH_ATTR}="true"] form[${EDITOR_WIDTH_CONTAINER_ATTR}="true"] .ant-form-item > [class*="ant-col-"].ant-form-item-control {
          max-width: 100% !important;
          width: 100% !important;
        }
      }
    `;

    if (style.textContent !== styleText) {
      style.textContent = styleText;
    }
  }

  function syncRouteWidthState() {
    ensureProfileWidthStyle();
    ensureEditorWidthStyle();
    setProfileWidthAttr();
    setEditorWidthAttr();
    markProfileWideContainers();
    markEditorWideContainers();
    markProfileWideTargets();
  }

  function queueRouteWidthRetries() {
    for (const delay of ROUTE_WIDTH_RETRY_DELAYS_MS) {
      setTimeout(syncRouteWidthState, delay);
    }
  }

  function queryNotificationBellCandidates() {
    const selectors = [
      `${HEADER_SELECTOR} a[href*="notification" i]`,
      `${HEADER_SELECTOR} button[aria-label*="notification" i]`,
      `${HEADER_SELECTOR} [role="button"][aria-label*="notification" i]`,
      `${HEADER_SELECTOR} [title*="notification" i]`,
      `${HEADER_SELECTOR} .ant-badge`,
      `${HEADER_SELECTOR} .anticon-bell`,
      `${HEADER_SELECTOR} [class*="bell" i]`,
      `${HEADER_SELECTOR} svg[aria-label*="notification" i]`,
      `${HEADER_SELECTOR} svg[aria-label*="bell" i]`,
    ];

    try {
      return [...document.querySelectorAll(selectors.join(','))];
    } catch {
      return [
        ...document.querySelectorAll(`${HEADER_SELECTOR} .ant-badge`),
        ...document.querySelectorAll(`${HEADER_SELECTOR} .anticon-bell`),
      ];
    }
  }

  function hasBellSignal(candidate, control) {
    const classText = [
      candidate?.className,
      candidate?.getAttribute?.('class'),
      control?.className,
      control?.getAttribute?.('class'),
    ]
      .map(value => typeof value === 'string' ? value : value?.baseVal || '')
      .join(' ')
      .toLowerCase();

    const labelText = [
      candidate?.getAttribute?.('aria-label'),
      candidate?.getAttribute?.('title'),
      candidate?.getAttribute?.('href'),
      control?.getAttribute?.('aria-label'),
      control?.getAttribute?.('title'),
      control?.getAttribute?.('href'),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (classText.includes('bell') || labelText.includes('notification') || labelText.includes('notif')) {
      return true;
    }

    if (candidate?.matches?.('.ant-badge') || control?.querySelector?.('.ant-badge')) {
      const badgeScope = candidate.matches?.('.ant-badge') ? candidate : control.querySelector('.ant-badge');
      const hasIcon = !!badgeScope?.querySelector?.('svg, .anticon');
      const hasAvatar = !!badgeScope?.querySelector?.('img, .ant-avatar, [class*="avatar" i]');
      const visibleText = normalizeText(badgeScope?.textContent);
      return hasIcon && !hasAvatar && visibleText.length <= 8;
    }

    return false;
  }

  function getNotificationBellControl(candidate) {
    const header = candidate?.closest?.(HEADER_SELECTOR);
    if (!header) return null;

    const interactive = candidate.closest('a, button, [role="button"]');
    const badge = candidate.closest('.ant-badge');
    const iconWrapper = candidate.closest('.anticon, [class*="bell" i]') || candidate.parentElement;
    const control = interactive && header.contains(interactive) ? interactive : badge || iconWrapper || candidate;
    if (!control || !header.contains(control) || !isVisibleElement(control)) return null;
    if (control.querySelector?.('img, .ant-avatar, [class*="avatar" i]')) return null;

    const visibleText = normalizeText(control.textContent);
    if (visibleText.length > 32 && !visibleText.toLowerCase().includes('notification')) return null;
    if (!hasBellSignal(candidate, control)) return null;

    return control;
  }

  function findNotificationBellControls() {
    const controls = [];
    for (const candidate of queryNotificationBellCandidates()) {
      const control = getNotificationBellControl(candidate);
      if (!control || controls.includes(control)) continue;
      controls.push(control);
    }
    return controls;
  }

  function badgeTextMeansUnread(text) {
    const normalized = normalizeText(text);
    if (!normalized) return false;
    const number = normalized.match(/\d+/)?.[0];
    if (number) return Number(number) > 0;
    if (/^(?:notifications?|unread)$/i.test(normalized)) return false;
    return !/^0\+?$/.test(normalized);
  }

  function hasUnreadNotification(control) {
    const readableState = [
      control.getAttribute?.('aria-label'),
      control.getAttribute?.('title'),
      control.getAttribute?.('data-state'),
      control.getAttribute?.('class'),
    ]
      .filter(Boolean)
      .join(' ');

    if (/\b(no|0)\s+unread\b/i.test(readableState)) return false;
    if (/\bunread\b/i.test(readableState)) return true;

    const scopes = [
      control,
      ...control.querySelectorAll?.('.ant-badge') || [],
    ];

    for (const scope of scopes) {
      const indicators = scope.querySelectorAll?.(
        '.ant-badge-dot, .ant-badge-count, .ant-scroll-number, [class*="unread" i], [class*="notification-count" i]',
      ) || [];

      for (const indicator of indicators) {
        if (!isVisibleElement(indicator)) continue;
        if (indicator.matches('.ant-badge-dot')) return true;

        const indicatorState = [
          indicator.textContent,
          indicator.getAttribute?.('title'),
          indicator.getAttribute?.('aria-label'),
        ]
          .filter(Boolean)
          .join(' ');

        if (/^0\+?$/.test(normalizeText(indicatorState))) continue;
        if (badgeTextMeansUnread(indicatorState)) return true;
        if (indicator.matches('[class*="unread" i], [class*="notification-count" i]')) return true;
      }
    }

    return false;
  }

  function syncNotificationBell() {
    ensureNotificationBellStyle();

    const controls = findNotificationBellControls();
    const activeControls = new Set(controls);

    for (const existing of document.querySelectorAll(`[${NOTIFICATION_BELL_ATTR}="true"]`)) {
      if (activeControls.has(existing) && existing.isConnected) continue;
      existing.removeAttribute(NOTIFICATION_BELL_ATTR);
      existing.removeAttribute(NOTIFICATION_UNREAD_ATTR);
    }

    for (const control of controls) {
      setAttributeIfChanged(control, NOTIFICATION_BELL_ATTR, 'true');
      setAttributeIfChanged(control, NOTIFICATION_UNREAD_ATTR, hasUnreadNotification(control) ? 'true' : 'false');
    }
  }

  function findCharacterHeader() {
    return [...document.querySelectorAll(HEADER_SELECTOR)].find(isVisibleElement) || null;
  }

  function findCharacterActionAnchor(header) {
    if (!header) return null;

    const avatar = [...header.querySelectorAll('img')].filter(isVisibleElement).pop();
    if (avatar) return avatar;

    const controls = [...header.querySelectorAll('a, button, [role="button"]')].filter(isVisibleElement);
    return controls.pop() || header;
  }

  function findCharacterActionBar() {
    for (const candidate of document.querySelectorAll(CHARACTER_ACTION_BAR_SELECTOR)) {
      if (!isVisibleElement(candidate)) continue;

      const labels = [...candidate.querySelectorAll('button, a, [role="button"]')]
        .map(getButtonLabel)
        .filter(Boolean);

      const hasFork = labels.includes('Fork');
      const hasAdd = labels.includes('Add');
      const hasOtherAction = labels.includes('Edit') || labels.includes('Report') || labels.includes('Favorite');

      if (hasFork && (hasAdd || hasOtherAction)) {
        return candidate;
      }
    }

    return null;
  }

  function updateGalleryReviewButtonState(button = document.querySelector(`[${GALLERY_REVIEW_BUTTON_ATTR}="true"]`)) {
    if (!button) return;

    const isActive = isGalleryReviewActive();
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    button.title = isActive
      ? 'Exit Gallery Review and restore normal auto-expanded sections'
      : 'Open Gallery and collapse Definitions/Discussion for art review';
    button.style.setProperty('background', isActive ? 'rgba(111, 156, 151, 0.18)' : '#050302');
    button.style.setProperty('border-color', isActive ? '#6f9c97' : 'rgba(255, 138, 0, 0.72)');
    button.style.setProperty('box-shadow', isActive ? '0 0 0 1px rgba(111, 156, 151, 0.34)' : 'none');
    button.style.setProperty('color', isActive ? '#bfe0dc' : '#ff8a00');
  }

  function ensureGalleryReviewButton(actionBar) {
    if (!actionBar) return;

    let row = actionBar.querySelector(`[${GALLERY_REVIEW_ROW_ATTR}="true"]`);
    if (!row) {
      row = document.createElement('div');
      row.setAttribute(GALLERY_REVIEW_ROW_ATTR, 'true');
      row.style.cssText = [
        'flex:0 0 100%',
        'display:flex',
        'justify-content:flex-end',
        'align-items:center',
        'order:999',
      ].join(';');
      actionBar.append(row);
    }

    let button = actionBar.querySelector(`[${GALLERY_REVIEW_BUTTON_ATTR}="true"]`);
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Gallery Review';
      button.setAttribute(GALLERY_REVIEW_BUTTON_ATTR, 'true');
      button.style.cssText = [
        'height:32px',
        'padding:0 12px',
        'border:1px solid rgba(255, 138, 0, 0.72)',
        'border-radius:6px',
        'background:#050302',
        'color:#ff8a00',
        'font:inherit',
        'font-weight:700',
        'line-height:1',
        'cursor:pointer',
        'white-space:nowrap',
        'color-scheme:dark',
      ].join(';');

      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleGalleryReview();
      });
    }

    if (button.parentElement !== row) {
      row.append(button);
    }

    updateGalleryReviewButtonState(button);
  }

  function dockCharacterActionBar() {
    const actionBar = findCharacterActionBar();
    if (!actionBar) return;

    ensureGalleryReviewButton(actionBar);

    const header = findCharacterHeader();
    const anchor = findCharacterActionAnchor(header);
    const headerRect = header?.getBoundingClientRect();
    const anchorRect = anchor?.getBoundingClientRect();
    const top = Math.round(Math.max(headerRect?.bottom || 52, anchorRect?.bottom || 52) + 8);
    const isMobile = window.innerWidth <= MOBILE_ACTION_BREAKPOINT;
    const right = isMobile
      ? 8
      : Math.max(12, Math.round(window.innerWidth - (anchorRect?.right || window.innerWidth - 12)));

    if (actionBar.dataset.chubActionDocked !== 'true') {
      actionBar.dataset.chubActionDocked = 'true';
      actionBar.dataset.chubActionPrevStyle = actionBar.getAttribute('style') || '';
    }

    actionBar.style.setProperty('position', 'fixed', 'important');
    actionBar.style.setProperty('top', `${top}px`, 'important');
    actionBar.style.setProperty('bottom', 'auto', 'important');
    actionBar.style.setProperty('left', isMobile ? '8px' : 'auto', 'important');
    actionBar.style.setProperty('right', `${right}px`, 'important');
    actionBar.style.setProperty('margin', '0', 'important');
    actionBar.style.setProperty('z-index', '1200', 'important');
    actionBar.style.setProperty('display', 'flex', 'important');
    actionBar.style.setProperty('flex-wrap', 'wrap', 'important');
    actionBar.style.setProperty('align-items', 'center', 'important');
    actionBar.style.setProperty('justify-content', 'flex-end', 'important');
    actionBar.style.setProperty('gap', '8px', 'important');
    actionBar.style.setProperty(
      'max-width',
      isMobile ? 'calc(100vw - 16px)' : 'min(620px, calc(100vw - 24px))',
      'important',
    );
  }

  function restoreDockedCharacterActionBars() {
    for (const actionBar of document.querySelectorAll(`[${CHARACTER_ACTION_DOCK_ATTR}="true"]`)) {
      const previousStyle = actionBar.dataset.chubActionPrevStyle || '';

      actionBar.querySelector(`[${GALLERY_REVIEW_ROW_ATTR}="true"]`)?.remove();
      actionBar.querySelector(`[${GALLERY_REVIEW_BUTTON_ATTR}="true"]`)?.remove();

      if (previousStyle) {
        actionBar.setAttribute('style', previousStyle);
      } else {
        actionBar.removeAttribute('style');
      }

      delete actionBar.dataset.chubActionDocked;
      delete actionBar.dataset.chubActionPrevStyle;
    }
  }

  function applyCharacterPageTweaks() {
    if (!isCharacterPage()) return;

    hideRecommendedSection();
    expandCharacterSections();
    enableGalleryMultiUpload();
    installGalleryUploadFallbacks();
    dockCharacterActionBar();
    runGalleryReview();
  }

  function findEditableIn(root) {
    if (!root) return null;

    return [...root.querySelectorAll('textarea, input:not([type="hidden"]):not([type="file"]), [contenteditable="true"]')]
      .find(element => isVisibleElement(element) && !element.disabled && element.getAttribute('aria-disabled') !== 'true') || null;
  }

  function findEditableBySelector(selectors) {
    for (const selector of selectors) {
      try {
        const match = [...document.querySelectorAll(selector)]
          .find(element => isVisibleElement(element) && !element.disabled && element.getAttribute('aria-disabled') !== 'true');
        if (match) return match;
      } catch {}
    }

    return null;
  }

  function getCollapseContent(item) {
    return item?.querySelector('.ant-collapse-content-box, .ant-collapse-content') || item || null;
  }

  function findEditorLabeledContainer(labels, root = document) {
    const needles = labels.map(label => label.toLowerCase());
    const candidates = root.querySelectorAll('label, .ant-form-item-label, .ant-typography, span');

    for (const element of candidates) {
      if (!isVisibleElement(element)) continue;

      const text = normalizeText(element.textContent).replace(/:$/, '').toLowerCase();
      if (!text || text.length > 90) continue;
      if (!needles.some(needle => text.includes(needle))) continue;

      return element.closest('.ant-form-item') || element.closest('[class*="form"]') || element.parentElement;
    }

    return null;
  }

  function findEditorAdvancedDefinitionsItem() {
    return findCharacterCollapseItem(EDITOR_ADVANCED_SECTION);
  }

  function ensureEditorAdvancedDefinitionsExpanded() {
    const item = findEditorAdvancedDefinitionsItem();
    if (item) setCollapseItemExpanded(item, true);
    return item;
  }

  function findEditorFirstAlternateGreeting() {
    const advancedItem = findEditorAdvancedDefinitionsItem();
    const scope = getCollapseContent(advancedItem) || document;
    const labeledContainer = findEditorLabeledContainer(['alternate greetings', 'alternate greeting'], scope);
    const labeledEditable = findEditableIn(labeledContainer);
    if (labeledEditable) return labeledEditable;

    const addButton = [...scope.querySelectorAll('button')]
      .find(button => getButtonLabel(button).toLowerCase().includes('add alternate greeting'));

    if (addButton) {
      const localContainer = addButton.closest('.ant-form-item') || addButton.closest('.ant-space')?.parentElement || scope;
      const localEditable = findEditableIn(localContainer);
      if (localEditable) return localEditable;

      const buttonRect = addButton.getBoundingClientRect();
      const nearbyTextareas = [...scope.querySelectorAll('textarea, [contenteditable="true"]')]
        .filter(element => {
          if (!isVisibleElement(element)) return false;
          return element.getBoundingClientRect().top >= buttonRect.bottom - 8;
        })
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);

      if (nearbyTextareas[0]) return nearbyTextareas[0];
    }

    return findEditableIn(scope);
  }

  function findEditorInitialMessage() {
    const selectorMatch = findEditableBySelector([
      'textarea[name*="initial" i]',
      'textarea[id*="initial" i]',
      'textarea[placeholder*="initial" i]',
      'textarea[name*="first" i]',
      'textarea[id*="first" i]',
      'textarea[placeholder*="first" i]',
      '[contenteditable="true"][aria-label*="initial" i]',
      '[contenteditable="true"][aria-label*="first" i]',
    ]);
    if (selectorMatch) return selectorMatch;

    const labeledContainer = findEditorLabeledContainer(['initial message', 'first message', 'first mes']);
    return findEditableIn(labeledContainer) || labeledContainer;
  }

  function findEditorTopAnchor() {
    const nameMatch = findEditableBySelector([
      'input[name="name" i]',
      'input[id="name" i]',
      'input[name*="name" i]',
      'input[id*="name" i]',
      'input[placeholder*="name" i]',
    ]);
    if (nameMatch) return nameMatch;

    const nameContainer = findEditorLabeledContainer(['name']);
    const nameEditable = findEditableIn(nameContainer);
    if (nameEditable) return nameEditable;

    const avatarContainer = findEditorLabeledContainer(['avatar']);
    const avatarImage = avatarContainer?.querySelector('img');
    return avatarImage || avatarContainer || document.querySelector('main h1, h1, main') || document.body;
  }

  function highlightEditorJumpTarget(target) {
    if (!target?.style) return;

    const previousOutline = target.style.outline;
    const previousBoxShadow = target.style.boxShadow;
    target.style.outline = '2px solid rgba(255, 138, 0, 0.9)';
    target.style.boxShadow = '0 0 0 4px rgba(255, 138, 0, 0.18)';

    setTimeout(() => {
      if (!target.isConnected) return;
      target.style.outline = previousOutline;
      target.style.boxShadow = previousBoxShadow;
    }, 1400);
  }

  function scrollToEditorTarget(target, shouldFocus = true) {
    if (!target) return false;

    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    highlightEditorJumpTarget(target);

    if (shouldFocus && target.matches?.('textarea, input, [contenteditable="true"]')) {
      setTimeout(() => target.focus({ preventScroll: true }), 260);
    }

    return true;
  }

  function runEditorJumpWithRetries(findTarget, shouldFocus = true) {
    let didJump = false;

    for (const delay of [0, 160, 420]) {
      setTimeout(() => {
        if (didJump) return;

        const target = findTarget();
        didJump = scrollToEditorTarget(target, shouldFocus);
      }, delay);
    }
  }

  function runEditorJumpAction(action) {
    if (action === 'top') {
      runEditorJumpWithRetries(findEditorTopAnchor);
      return;
    }

    if (action === 'ag0') {
      ensureEditorAdvancedDefinitionsExpanded();
      runEditorJumpWithRetries(findEditorFirstAlternateGreeting);
      return;
    }

    if (action === 'initial') {
      runEditorJumpWithRetries(findEditorInitialMessage);
    }
  }

  function styleEditorJumpDock(dock) {
    const isMobile = window.innerWidth <= MOBILE_ACTION_BREAKPOINT;
    const desktopDockWidth = 'clamp(220px, 18vw, 280px)';
    dock.style.cssText = [
      'position:fixed',
      isMobile ? 'left:8px' : 'left:auto',
      isMobile ? 'right:8px' : 'right:18px',
      isMobile ? 'top:auto' : 'top:112px',
      isMobile ? 'bottom:14px' : 'bottom:auto',
      'z-index:1300',
      'display:flex',
      'flex-direction:row',
      'flex-wrap:wrap',
      isMobile ? 'justify-content:flex-end' : 'justify-content:flex-start',
      'align-items:stretch',
      'gap:7px',
      'pointer-events:auto',
      isMobile ? 'max-width:calc(100vw - 16px)' : 'max-width:min(280px, calc(100vw - 36px))',
      isMobile ? 'width:auto' : `width:${desktopDockWidth}`,
      isMobile ? '--chub-editor-jump-button-flex:1 1 112px' : '--chub-editor-jump-button-flex:1 1 104px',
      isMobile ? '--chub-editor-jump-button-min-width:min(108px, 100%)' : '--chub-editor-jump-button-min-width:min(102px, 100%)',
    ].join(';');
  }

  function createEditorJumpButton(config) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = config.label;
    button.title = config.title;
    button.dataset.chubEditorJumpAction = config.action;
    button.setAttribute(EDITOR_JUMP_BUTTON_ATTR, 'true');
    button.style.cssText = [
      'box-sizing:border-box',
      'min-height:32px',
      'flex:var(--chub-editor-jump-button-flex, 0 0 auto)',
      'min-width:var(--chub-editor-jump-button-min-width, 100%)',
      'max-width:100%',
      'width:auto',
      'padding:0 12px',
      'border:1px solid rgba(255, 138, 0, 0.78)',
      'border-radius:8px',
      'background:#050302',
      'color:#ff8a00',
      'font:inherit',
      'font-weight:800',
      'line-height:1',
      'cursor:pointer',
      'white-space:nowrap',
      'text-align:center',
      'color-scheme:dark',
      'box-shadow:0 1px 0 rgba(255, 138, 0, 0.16), 0 0 0 1px rgba(0, 0, 0, 0.28)',
    ].join(';');

    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      runEditorJumpAction(config.action);
    });

    return button;
  }

  function cleanupEditorJumpDock() {
    for (const dock of document.querySelectorAll(`[${EDITOR_JUMP_DOCK_ATTR}="true"]`)) {
      dock.remove();
    }
  }

  function ensureEditorJumpDock() {
    if (!isEditorPage()) {
      cleanupEditorJumpDock();
      return;
    }

    let dock = document.querySelector(`[${EDITOR_JUMP_DOCK_ATTR}="true"]`);
    if (!dock) {
      dock = document.createElement('div');
      dock.setAttribute(EDITOR_JUMP_DOCK_ATTR, 'true');
      document.body.append(dock);
    }

    styleEditorJumpDock(dock);

    const expectedActions = EDITOR_JUMP_BUTTONS.map(button => button.action).join('|');
    const actualActions = [...dock.querySelectorAll(`[${EDITOR_JUMP_BUTTON_ATTR}="true"]`)]
      .map(button => button.dataset.chubEditorJumpAction)
      .join('|');

    if (actualActions !== expectedActions) {
      dock.replaceChildren(...EDITOR_JUMP_BUTTONS.map(createEditorJumpButton));
    }
  }

  function applyEditorPageTweaks() {
    ensureEditorJumpDock();
  }

  // =============================================
  //  API + Sorting
  // =============================================

  async function fetchAllCards(username, sort) {
    const token = (() => { try { return localStorage.getItem('URQL_TOKEN') || ''; } catch { return ''; } })();
    const serverSort = CLIENT_SORT_KEYS.has(sort) ? 'created_at' : sort;
    const params = new URLSearchParams({
      first: '500', namespace: 'characters', nsfw: 'true', nsfl: 'true',
      chub: 'true', include_forks: 'true', count: 'true', sort: serverSort, username, page: '1',
    });
    const res = await fetch(`https://gateway.chub.ai/search?${params}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ch-api-key': token, samwise: token },
      body: '{}',
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    let nodes = data?.data?.nodes || [];

    if (CLIENT_SORT_KEYS.has(sort)) {
      nodes = sortCreatorNodes(nodes, sort, 'desc');
    }

    return nodes;
  }

  function getClientSortValue(node, sort) {
    if (sort === 'lastActivityAt') {
      const time = new Date(node.lastActivityAt || node.last_activity_at || node.updatedAt || 0).getTime();
      return Number.isFinite(time) ? time : 0;
    }

    return Number(node[sort] || 0);
  }

  function sortCreatorNodes(nodes, sort, direction) {
    const sorted = [...nodes].sort((a, b) => getClientSortValue(b, sort) - getClientSortValue(a, sort));
    return direction === 'asc' ? sorted.reverse() : sorted;
  }

  // =============================================
  //  Shared Formatting
  // =============================================

  function fmtNum(n) {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  }

  function fmtAge(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return mins + 'm';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h';
    const days = Math.floor(hrs / 24);
    if (days < 7) return days + 'd';
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return weeks + 'w';
    const months = Math.floor(days / 30);
    if (months < 12) return months + 'mo';
    return Math.floor(days / 365) + 'y';
  }

  // =============================================
  //  Render + Toolbar
  // =============================================

  const savedPrefs = loadPrefs();
  let currentSort = savedPrefs.sort;
  let currentDirection = savedPrefs.direction;
  let activeCreator = null;
  let lastRouteKey = getRouteKey();
  let syncQueued = false;
  let sortRunId = 0;
  let nativeCardTemplate = null;
  let nativeGridClassName = '';
  let galleryReviewRouteKey = null;
  let galleryReviewScrolledRouteKey = null;

  function findGrid() {
    return document.querySelector('.character-list-container:not([data-chub-sort-grid])');
  }

  function hideNativeGrid(grid) {
    if (!grid) return;

    if (grid.dataset.chubSortNativeHidden !== 'true') {
      grid.dataset.chubSortNativeHidden = 'true';
      grid.dataset.chubSortPrevDisplay = grid.style.getPropertyValue('display') || '';
      grid.dataset.chubSortPrevDisplayPriority = grid.style.getPropertyPriority('display') || '';
    }

    grid.style.setProperty('display', 'none', 'important');
  }

  function restoreNativeGrid() {
    for (const grid of document.querySelectorAll('.character-list-container[data-chub-sort-native-hidden="true"]')) {
      const previousDisplay = grid.dataset.chubSortPrevDisplay || '';
      const previousPriority = grid.dataset.chubSortPrevDisplayPriority || '';

      if (previousDisplay) {
        grid.style.setProperty('display', previousDisplay, previousPriority);
      } else {
        grid.style.removeProperty('display');
      }

      delete grid.dataset.chubSortNativeHidden;
      delete grid.dataset.chubSortPrevDisplay;
      delete grid.dataset.chubSortPrevDisplayPriority;
    }
  }

  function rememberNativeTemplates() {
    const grid = findGrid();
    if (!grid) return;

    if (!nativeGridClassName) {
      nativeGridClassName = grid.className;
    }

    if (!nativeCardTemplate) {
      const template = grid.querySelector('a[href] > .char-card-class')?.parentElement;
      if (template) {
        nativeCardTemplate = template.cloneNode(true);
      }
    }
  }

  function setTrailingText(container, text) {
    if (!container) return;

    const icon = container.firstElementChild?.cloneNode(true);
    container.replaceChildren();
    if (icon) {
      container.append(icon);
    }
    container.append(document.createTextNode(` ${text}`));
  }

  function buildTagElement(tagTemplate, text) {
    if (!tagTemplate) return null;

    const tag = tagTemplate.cloneNode(true);
    const label = tag.querySelector('.ant-tag > span:first-child') || tag.querySelector('.ant-tag span');
    if (label) {
      label.textContent = text;
    } else {
      tag.textContent = text;
    }
    return tag;
  }

  function buildNativeCard(node) {
    if (!nativeCardTemplate) return null;

    const cardLink = nativeCardTemplate.cloneNode(true);
    cardLink.href = `/characters/${node.fullPath}`;

    const title = cardLink.querySelector('.card-title-row > span span');
    const chats = cardLink.querySelector('.card-title-row > div:last-child');
    const image = cardLink.querySelector('img');
    const stats = cardLink.querySelectorAll('.fake-ribbon.grid.grid-cols-3 > div');
    const description = cardLink.querySelector('.ant-card-meta-description .quote-color');
    const tagMount = cardLink.querySelector('.custom-scroll .mt-2');
    const usernameLink = cardLink.querySelector('p a');
    const usernameText = usernameLink?.querySelector('span');
    const ageText = cardLink.querySelector('.ant-btn-sm span');
    const regularTagTemplate = tagMount?.querySelector('.cursor-pointer') || null;
    const nsfwTagTemplate = tagMount?.querySelector('.ant-tag-error') || null;

    if (title) title.textContent = node.name || '';
    if (chats) setTrailingText(chats, fmtNum(node.nChats || 0));

    if (image) {
      image.alt = node.name || '';
      image.src = node.avatar_url || '';
    }

    if (stats[0]) setTrailingText(stats[0], fmtNum(node.n_favorites || 0));
    if (stats[1]) setTrailingText(stats[1], fmtNum(node.starCount || 0));
    if (stats[2]) setTrailingText(stats[2], fmtNum(node.nTokens || 0));

    if (description) {
      description.textContent = node.tagline || '';
    }

    if (tagMount) {
      tagMount.replaceChildren();

      const topics = Array.isArray(node.topics) ? node.topics : [];
      const isNSFW = topics.some(tag => tag.toUpperCase() === 'NSFW');
      const visibleTags = topics.filter(tag => tag.toUpperCase() !== 'NSFW').slice(0, 8);

      if (isNSFW && nsfwTagTemplate) {
        tagMount.append(nsfwTagTemplate.cloneNode(true));
      }

      for (const tagText of visibleTags) {
        const tag = buildTagElement(regularTagTemplate, tagText);
        if (tag) tagMount.append(tag);
      }
    }

    if (usernameLink) usernameLink.href = `/users/${getCreatorUsername()}`;
    if (usernameText) usernameText.textContent = `@${getCreatorUsername()}`;
    if (ageText) ageText.textContent = fmtAge(node.createdAt || node.created_at || node.lastActivityAt || Date.now());

    return cardLink;
  }

  function hideNativeSort(grid) {
    const nativeSort = grid.parentElement?.querySelector('.ant-select');
    const container = nativeSort?.closest('.ant-form-item') || nativeSort?.parentElement;
    if (!container || container.dataset.chubSortHidden === 'true') return;

    container.dataset.chubSortHidden = 'true';
    container.dataset.chubSortPrevDisplay = container.style.getPropertyValue('display') || '';
    container.dataset.chubSortPrevDisplayPriority = container.style.getPropertyPriority('display') || '';
    container.style.setProperty('display', 'none', 'important');
  }

  function restoreNativeSort() {
    for (const container of document.querySelectorAll('[data-chub-sort-hidden="true"]')) {
      const previousDisplay = container.dataset.chubSortPrevDisplay || '';
      const previousPriority = container.dataset.chubSortPrevDisplayPriority || '';

      if (previousDisplay) {
        container.style.setProperty('display', previousDisplay, previousPriority);
      } else {
        container.style.removeProperty('display');
      }

      delete container.dataset.chubSortHidden;
      delete container.dataset.chubSortPrevDisplay;
      delete container.dataset.chubSortPrevDisplayPriority;
    }
  }

  function ensureSortStyle() {
    const styleText = `
      .ant-pagination { display: none !important; }
      [data-chub-sort-toolbar],
      [data-chub-sort-toolbar] * {
        color-scheme: dark !important;
      }
      [data-chub-sort-toolbar] {
        color: ${TOOLBAR_TEXT} !important;
      }
      [data-chub-sort-toolbar] select,
      [data-chub-sort-toolbar] option,
      [data-chub-sort-toolbar] button {
        background: ${TOOLBAR_SURFACE} !important;
        background-color: ${TOOLBAR_SURFACE} !important;
        color: ${TOOLBAR_TEXT} !important;
        border-color: ${TOOLBAR_BORDER} !important;
        font-weight: 700 !important;
      }
      [data-chub-sort-toolbar] button {
        font-weight: 800 !important;
      }
    `;

    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = styleText;
  }

  function cleanupCustomView() {
    document.querySelector(CUSTOM_GRID_SELECTOR)?.remove();
    document.querySelector(TOOLBAR_SELECTOR)?.remove();
    document.getElementById(STYLE_ID)?.remove();
    restoreNativeSort();
    restoreNativeGrid();

    const grid = findGrid();
    if (grid) {
      grid.style.removeProperty('display');
    }
  }

  async function renderCards(nodes) {
    const grid = findGrid();
    if (!grid) return;
    rememberNativeTemplates();
    if (!nativeCardTemplate) return;

    if (currentDirection === 'asc') nodes = [...nodes].reverse();

    // Hide React's grid instead of replacing its children (prevents removeChild crash).
    // Some profile CSS forces .character-list-container to display:grid !important,
    // so this must also use an inline !important.
    hideNativeGrid(grid);

    // Create or reuse a custom container outside React's tree
    let customGrid = document.querySelector(CUSTOM_GRID_SELECTOR);
    if (!customGrid) {
      customGrid = document.createElement('div');
      customGrid.setAttribute('data-chub-sort-grid', 'true');
      grid.parentElement.insertBefore(customGrid, grid.nextSibling);
    }
    customGrid.className = nativeGridClassName || grid.className;
    customGrid.removeAttribute('style');

    const fragment = document.createDocumentFragment();
    for (const node of nodes) {
      const card = buildNativeCard(node);
      if (card) fragment.append(card);
    }
    customGrid.replaceChildren(fragment);

    ensureSortStyle();
  }

  async function doSort() {
    const username = getCreatorUsername();
    if (!username) return;
    const runId = ++sortRunId;
    const toolbar = document.querySelector(TOOLBAR_SELECTOR);
    const select = toolbar?.querySelector('select');
    const dirBtn = toolbar?.querySelector('button');
    if (select) select.disabled = true;
    if (dirBtn) dirBtn.disabled = true;
    try {
      const nodes = await fetchAllCards(username, currentSort);
      if (runId !== sortRunId || username !== getCreatorUsername() || !isCreatorPage()) return;
      await renderCards(nodes);
    } catch (e) {
      console.warn('[Chub Sort] Failed:', e);
    } finally {
      if (runId === sortRunId) {
        if (select) select.disabled = false;
        if (dirBtn) dirBtn.disabled = false;
      }
    }
  }

  function injectToolbar() {
    if (!isCreatorPage()) return;
    if (document.querySelector(TOOLBAR_SELECTOR)) return;

    const grid = findGrid();
    if (!grid) return;
    ensureSortStyle();

    const toolbar = document.createElement('div');
    toolbar.setAttribute('data-chub-sort-toolbar', 'true');
    toolbar.style.cssText = [
      'display:flex', 'align-items:center', 'gap:8px', 'flex-wrap:wrap',
      'margin-top:10px',
      'margin-bottom:12px',
    ].join(';');

    const label = document.createElement('span');
    label.textContent = 'Sort:';
    label.style.cssText = `font: inherit;color: ${TOOLBAR_TEXT};font-weight: 700;white-space: nowrap;`;

    const select = document.createElement('select');
    select.style.cssText = [
      'font: inherit',
      'font-weight: 700',
      `color: ${TOOLBAR_TEXT}`,
      `background-color: ${TOOLBAR_SURFACE}`,
      `border: 1px solid ${TOOLBAR_BORDER}`,
      'border-radius: 6px',
      'padding: 4px 8px',
      'cursor: pointer',
      'color-scheme: dark',
    ].join(';');
    for (const s of ALL_SORTS) {
      const opt = document.createElement('option');
      opt.value = s.value;
      opt.textContent = s.label;
      opt.style.color = TOOLBAR_TEXT;
      opt.style.backgroundColor = TOOLBAR_SURFACE;
      if (s.value === currentSort) opt.selected = true;
      select.appendChild(opt);
    }

    const dirBtn = document.createElement('button');
    dirBtn.style.cssText = [
      'font: inherit', 'font-weight: 800',
      `color: ${TOOLBAR_TEXT}`,
      `background: ${TOOLBAR_SURFACE}`,
      `border: 1px solid ${TOOLBAR_BORDER}`, 'border-radius: 6px',
      'padding: 4px 10px', 'cursor: pointer', 'line-height: 1', 'min-width: 36px',
      'color-scheme: dark',
    ].join(';');
    const updateDirBtn = () => {
      dirBtn.textContent = currentDirection === 'desc' ? '\u2193' : '\u2191';
      dirBtn.title = currentDirection === 'desc'
        ? 'Descending (click for ascending)' : 'Ascending (click for descending)';
    };
    updateDirBtn();

    select.addEventListener('change', () => {
      currentSort = select.value;
      savePrefs(currentSort, currentDirection);
      doSort();
    });

    dirBtn.addEventListener('click', () => {
      currentDirection = currentDirection === 'desc' ? 'asc' : 'desc';
      updateDirBtn();
      savePrefs(currentSort, currentDirection);
      const customGrid = document.querySelector(CUSTOM_GRID_SELECTOR);
      if (customGrid) {
        customGrid.append(...[...customGrid.children].reverse());
      } else {
        doSort();
      }
    });

    toolbar.append(label, select, dirBtn);
    grid.parentElement.insertBefore(toolbar, grid);

    hideNativeSort(grid);

    // Apply saved sort on initial load.
    doSort();
  }

  function syncPage() {
    ensurePortalTopLayerStyle();
    syncNotificationBell();
    syncRouteWidthState();

    const routeChanged = getRouteKey() !== lastRouteKey;
    if (routeChanged) {
      lastRouteKey = getRouteKey();
      galleryReviewRouteKey = null;
      galleryReviewScrolledRouteKey = null;
      syncRouteWidthState();
      queueRouteWidthRetries();
    }

    if (!isCharacterPage()) {
      restoreDockedCharacterActionBars();
    }

    applyCharacterPageTweaks();
    applyEditorPageTweaks();
    rememberNativeTemplates();

    if (!isCreatorPage()) {
      if (activeCreator || document.querySelector(TOOLBAR_SELECTOR) || document.querySelector(CUSTOM_GRID_SELECTOR)) {
        cleanupCustomView();
      }
      activeCreator = null;
      return;
    }

    const username = getCreatorUsername();
    const grid = findGrid();
    if (!username || !grid) return;

    if (routeChanged && activeCreator && activeCreator !== username) {
      cleanupCustomView();
    }

    if (activeCreator !== username) {
      activeCreator = username;
    }

    if (!document.querySelector(TOOLBAR_SELECTOR)) {
      injectToolbar();
      return;
    }

    hideNativeSort(grid);

    if (!document.querySelector(CUSTOM_GRID_SELECTOR)) {
      doSort();
    }
  }

  function queueSync() {
    if (syncQueued) return;

    syncQueued = true;
    requestAnimationFrame(() => {
      syncQueued = false;
      syncPage();
    });
  }

  function installHistoryHooks() {
    const { pushState, replaceState } = history;

    history.pushState = function (...args) {
      const result = pushState.apply(this, args);
      queueSync();
      return result;
    };

    history.replaceState = function (...args) {
      const result = replaceState.apply(this, args);
      queueSync();
      return result;
    };

    window.addEventListener('popstate', queueSync);
    window.addEventListener('resize', queueSync);
  }

  // Watch for grid to appear and inject
  const observer = new MutationObserver(() => {
    queueSync();
  });

  function startTweaks() {
    if (!document.body) return false;

    syncRouteWidthState();

    observer.observe(document.body, { childList: true, subtree: true });
    installHistoryHooks();
    queueSync();
    queueRouteWidthRetries();
    window.setInterval(syncNotificationBell, NOTIFICATION_SYNC_INTERVAL_MS);

    return true;
  }

  if (!startTweaks()) {
    document.addEventListener('DOMContentLoaded', startTweaks, { once: true });
  }
})();
