function checkOutage({ outageMin, monthlyFee }) {
  const ratio = 1.0;
  const minutesPerMonth = 43200;
  return +(((outageMin * ratio) / minutesPerMonth) * Number(monthlyFee) * 10).toFixed(2);
}

function checkLatency(last5, monthlyFee) {
  if (!last5 || last5.length < 5) return { violated: false, credit: 0 };
  const avg = last5.reduce((a, b) => a + b, 0) / last5.length;
  if (avg > 200)
    return { violated: true, credit: +(Number(monthlyFee) * 0.15).toFixed(2), avg: Math.round(avg) };
  return { violated: false, credit: 0, avg: Math.round(avg) };
}

function claimDeadline(from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

module.exports = { checkOutage, checkLatency, claimDeadline };
