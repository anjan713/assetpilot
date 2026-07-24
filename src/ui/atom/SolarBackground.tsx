interface SolarBackgroundProps {
  width: number
  height: number
}

/** Deterministic star field — same sky every render, no flicker. */
function makeStars(count: number): Array<{ x: number; y: number; r: number; o: number }> {
  let seed = 137
  const next = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }
  return Array.from({ length: count }, () => ({
    x: next(),
    y: next(),
    r: 0.4 + next() * 1.1,
    o: 0.12 + next() * 0.45,
  }))
}

const STARS = makeStars(80)

export function SolarBackground({ width, height }: SolarBackgroundProps) {
  return (
    <g className="solar" aria-hidden="true">
      {STARS.map((star, index) => (
        <circle
          key={index}
          cx={star.x * width}
          cy={star.y * height}
          r={star.r}
          fill="#F1EDE4"
          opacity={star.o}
          className={index % 3 === 0 ? 'star-twinkle' : undefined}
        />
      ))}
    </g>
  )
}
