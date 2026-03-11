type CarSpriteProps = {
  fill: string;
  secondary: string;
  x: number;
  y: number;
  angle: number;
};

export function CarSprite({ fill, secondary, x, y, angle }: CarSpriteProps) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <g transform="translate(-16 -7)">
        <path
          d="M16 0 20 2.2 21.5 5 27.8 5.8 31 7 27.8 8.2 21.5 9 20 11.8 16 14 12 11.8 10.5 9 4.2 8.2 1 7 4.2 5.8 10.5 5 12 2.2Z"
          fill={fill}
        />
        <path
          d="M13.4 2.6h5.2v8.8h-5.2zM4.8 6.2h22.4v1.6H4.8z"
          fill={secondary}
          opacity="0.85"
        />
      </g>
    </g>
  );
}
