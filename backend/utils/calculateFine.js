const calculateFine = (dueDate, returnDate = new Date(), fineRatePerDay = 1.00) => {
  const due = new Date(dueDate);
  const returned = new Date(returnDate);
  
  const timeDiff = returned.getTime() - due.getTime();
  const daysOverdue = Math.ceil(timeDiff / (1000 * 3600 * 24));
  
  if (daysOverdue > 0) {
    return daysOverdue * fineRatePerDay;
  }
  
  return 0;
};

const getFineRate = () => {
  return parseFloat(process.env.FINE_RATE_PER_DAY) || 1.00;
};

module.exports = { calculateFine, getFineRate };