/** Галочка верификации — изображение public/verified.png */
export default function VerifiedBadge({ className = "" }: { className?: string }) {
  return (
    <img
      src="/verified.png"
      alt=""
      width={18}
      height={18}
      className={`inline-block shrink-0 align-middle ${className}`}
      draggable={false}
    />
  );
}
