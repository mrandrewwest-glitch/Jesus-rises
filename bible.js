// Shared Bible-version setting for every game.
// The menu (index.html) lets the player pick a version; each game keeps its own
// table of verses and asks Bible.verse() for the text in the chosen version.
// If a version's text hasn't been added for a verse yet, the KJV is shown and
// labelled as KJV, so a quote is never attributed to the wrong translation.
(function () {
  'use strict';

  const KEY = 'bibleVersion';

  const VERSIONS = {
    KJV: {
      name: 'King James Version',
      credit: 'Scripture quotations are from the King James Version (public domain).',
    },
    NKJV: {
      name: 'New King James Version',
      credit: 'Scripture taken from the New King James Version®. Copyright © 1982 by Thomas Nelson. Used by permission. All rights reserved.',
    },
    NIV: {
      name: 'New International Version',
      credit: 'Scripture quotations taken from The Holy Bible, New International Version® NIV®. Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc.™ Used by permission. All rights reserved worldwide.',
    },
    NLT: {
      name: 'New Living Translation',
      credit: 'Scripture quotations are taken from the Holy Bible, New Living Translation, copyright © 1996, 2004, 2015 by Tyndale House Foundation. Used by permission of Tyndale House Publishers, Carol Stream, Illinois 60188. All rights reserved.',
    },
  };

  function current() {
    let v = null;
    try { v = localStorage.getItem(KEY); } catch (e) {}
    return VERSIONS[v] ? v : 'KJV';
  }

  function set(v) {
    if (!VERSIONS[v]) return;
    try { localStorage.setItem(KEY, v); } catch (e) {}
  }

  // entry: { ref: 'Mark 4:39', KJV: '...', NKJV: '...', NIV: '...', NLT: '...' }
  // Returns { text, ref, version, cite } where cite is e.g. "Mark 4:39 (NIV)".
  function verse(entry) {
    const want = current();
    const version = entry[want] ? want : 'KJV';
    const text = entry[version] || '';
    return { text, ref: entry.ref, version, cite: `${entry.ref} (${version})` };
  }

  // Credit lines for the versions actually shown by a game's verse table.
  function credits(table) {
    const used = new Set(Object.values(table || {}).map((e) => verse(e).version));
    if (!table) used.add(current());
    return [...used].map((v) => VERSIONS[v].credit);
  }

  window.Bible = { VERSIONS, current, set, verse, credits };
})();
