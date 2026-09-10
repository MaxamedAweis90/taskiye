import React, { ReactNode } from 'react';

export interface CustomScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  maxHeight?: string | number;
  className?: string;
  showFadeBottom?: boolean;
}

/**
 * Reusable sleek dark custom scrollable container for consistent aesthetics across Taskiye.
 */
export const CustomScrollArea: React.FC<CustomScrollAreaProps> = ({
  children,
  maxHeight,
  className = '',
  showFadeBottom = false,
  ...props
}) => {
  return (
    <div className="relative w-full overflow-hidden" {...props}>
      <div
        className={`overflow-y-auto overflow-x-hidden pr-1.5 custom-scrollbar ${className}`}
        style={maxHeight !== undefined ? { maxHeight } : undefined}
      >
        {children}
      </div>

      {showFadeBottom && (
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-[#162032] to-transparent" />
      )}
    </div>
  );
};

export default CustomScrollArea;
