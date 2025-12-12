'use client';

export function MiloWaveLogo() {
  return (
    <div
      className="fixed z-30 pointer-events-none flex flex-col items-center"
      style={{
        top: '8%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(280px, 30vw)',
      }}
    >
      {/* Logo MILO blanc */}
      <div className="relative w-full" style={{ aspectRatio: '1440 / 533.33' }}>
        <img
          src="/MILO_RVB_BLANC.svg"
          alt="MILO"
          className="absolute inset-0 w-full h-full"
          style={{
            filter: 'drop-shadow(0 0 15px rgba(255,255,255,0.2))',
          }}
        />
      </div>

      {/* Tagline */}
      <p
        className="text-center mt-2 hidden sm:block"
        style={{
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 700,
          fontSize: 'clamp(8px, 1.2vw, 11px)',
          letterSpacing: '0.15em',
          color: 'white',
          opacity: 0.9,
        }}
      >
        OPEN YOUR MIND, CLOSE THE DEAL
      </p>

      {/* Mobile tagline - 2 lines */}
      <div className="text-center mt-1 block sm:hidden">
        <p
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 700,
            fontSize: '10px',
            letterSpacing: '0.1em',
            color: 'white',
            opacity: 0.9,
            margin: 0,
          }}
        >
          OPEN YOUR MIND
        </p>
        <p
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 700,
            fontSize: '10px',
            letterSpacing: '0.1em',
            color: 'white',
            opacity: 0.9,
            margin: 0,
          }}
        >
          CLOSE THE DEAL
        </p>
      </div>
    </div>
  );
}
