import { useMemo, useState } from 'react';
import './LoanCalculator.css';

const ringgit = (value) => `RM ${Math.round(value).toLocaleString('en-MY')}`;

// "1,000,000" or "1000000" -> 1000000. Anything that is not a number becomes NaN.
const toNumber = (text) => Number(String(text).replace(/,/g, '').trim());

// Estimates a monthly home loan repayment. Pure maths, nothing is sent to the server.
// defaultAmount pre-fills the loan amount (a project page passes its lowest price).
export default function LoanCalculator({ defaultAmount = 1000000 }) {
  const [amount, setAmount] = useState(String(Math.round(defaultAmount)));
  const [rate, setRate] = useState('4.0');
  const [years, setYears] = useState('30');

  const result = useMemo(() => {
    const principal = toNumber(amount);
    const yearly = toNumber(rate);
    const tenure = toNumber(years);
    if (!(principal > 0) || !(yearly >= 0 && yearly <= 20) || !(tenure >= 1 && tenure <= 35)) return null;

    const months = Math.round(tenure * 12);
    const monthlyRate = yearly / 100 / 12;
    // Standard loan formula: P * r / (1 - (1 + r)^-n). With a 0% rate it is simply P / n.
    const monthly =
      monthlyRate === 0
        ? principal / months
        : (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
    const total = monthly * months;
    const interest = total - principal;
    return {
      monthly,
      total,
      interest,
      principal,
      principalShare: Math.round((principal / total) * 100),
    };
  }, [amount, rate, years]);

  return (
    <section className="loan" aria-labelledby="loan-title">
      <div className="loan-inner">
        <div className="loan-head">
          <h2 id="loan-title">Home loan calculator</h2>
          <p>Estimate your monthly repayment before you decide. It takes a minute.</p>
        </div>

        <div className="loan-card">
          <form className="loan-form" onSubmit={(event) => event.preventDefault()}>
            <label className="loan-field">
              Loan amount (not the property price)
              <span className="loan-input">
                <span className="loan-prefix">RM</span>
                <input
                  inputMode="numeric"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </span>
            </label>

            <div className="loan-row">
              <label className="loan-field">
                Interest rate
                <span className="loan-input">
                  <span className="loan-prefix">%</span>
                  <input
                    inputMode="decimal"
                    value={rate}
                    onChange={(event) => setRate(event.target.value)}
                  />
                </span>
              </label>

              <label className="loan-field">
                Loan tenure
                <span className="loan-input">
                  <span className="loan-prefix">Yrs</span>
                  <input
                    inputMode="numeric"
                    value={years}
                    onChange={(event) => setYears(event.target.value)}
                  />
                </span>
              </label>
            </div>
          </form>

          <div className="loan-result" aria-live="polite">
            <h3>Repayment summary</h3>
            {result ? (
              <>
                <p className="loan-monthly">
                  <span>Estimated monthly repayment</span>
                  <strong>{ringgit(result.monthly)} / month</strong>
                </p>

                <div
                  className="loan-bar"
                  role="img"
                  aria-label={`${result.principalShare}% principal, ${100 - result.principalShare}% interest`}
                >
                  <span className="loan-bar-principal" style={{ width: `${result.principalShare}%` }}>
                    {result.principalShare >= 12 && `${result.principalShare}%`}
                  </span>
                  <span className="loan-bar-interest">
                    {100 - result.principalShare >= 12 && `${100 - result.principalShare}%`}
                  </span>
                </div>

                <ul className="loan-legend">
                  <li><span className="dot dot-principal" /> {ringgit(result.principal)} principal</li>
                  <li><span className="dot dot-interest" /> {ringgit(result.interest)} interest</li>
                </ul>

                <p className="loan-total">Total over the loan: {ringgit(result.total)}</p>
              </>
            ) : (
              <p className="loan-hint">
                Enter a loan amount, an interest rate up to 20% and a tenure from 1 to 35 years.
              </p>
            )}
            <p className="loan-note">
              An estimate for planning only. Your bank's actual rate, fees and approval will differ.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
