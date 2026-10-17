import { useCountUp } from './motion';

/** v3.2: a number that counts up when it first appears; the final value when motion is reduced. */
export function CountUp({
  value,
  decimals = 0,
  suffix = '',
}: {
  value: number;
  decimals?: number;
  suffix?: string;
}) {
  const shown = useCountUp(value);
  const text = shown.toLocaleString('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return (
    <>
      {text}
      {suffix}
    </>
  );
}
