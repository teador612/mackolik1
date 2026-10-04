function merge(oldMatches, newMatches) {
  const map = new Map();

  /*
   * Eski verileri ekle.
   * Hatalı/başlık kayıtlarını alma.
   */
  for (const match of oldMatches) {
    if (!isValidMatch(match)) {
      continue;
    }

    map.set(match.id, match);
  }

  /*
   * Yeni Mackolik maçlarını ekle/güncelle.
   */
  for (const match of newMatches) {
    if (!isValidMatch(match)) {
      continue;
    }

    const old = map.get(match.id);

    if (!old) {
      map.set(match.id, match);
      continue;
    }

    map.set(match.id, {
      ...old,
      ...match,

      homeScore:
        old.homeScore ??
        match.homeScore,

      awayScore:
        old.awayScore ??
        match.awayScore,

      halfHomeScore:
        old.halfHomeScore ??
        match.halfHomeScore,

      halfAwayScore:
        old.halfAwayScore ??
        match.halfAwayScore
    });
  }

  return [...map.values()];
}


/* =========================================================
   GEÇERLİ MAÇ KONTROLÜ
========================================================= */

function isValidMatch(match) {
  if (!match) {
    return false;
  }

  if (!match.id) {
    return false;
  }

  if (!match.date) {
    return false;
  }

  if (!match.home || !match.away) {
    return false;
  }

  const home = normalize(match.home);
  const away = normalize(match.away);

  /*
   * Önceden yanlışlıkla oluşturulan başlık kayıtları.
   */
  const invalidNames = [
    "macsonucu",
    "ilkyarisonucu",
    "altust",
    "ilkyarisonucualtust",
    "ms",
    "iy",
    "iy1",
    "iy2",
    "alt",
    "ust",
    "ts"
  ];

  if (
    invalidNames.includes(home) ||
    invalidNames.includes(away)
  ) {
    return false;
  }

  /*
   * Takım adı sadece sayı olamaz.
   */
  if (
    /^\d+(?:[,.]\d+)?$/.test(match.home) ||
    /^\d+(?:[,.]\d+)?$/.test(match.away)
  ) {
    return false;
  }

  /*
   * Ev sahibi ve deplasman aynı olamaz.
   */
  if (home === away) {
    return false;
  }

  return true;
}
