import React, { useState } from "react";

interface AnimatedBackgroundProps {
  children: React.ReactNode;
  className?: string;
  defaultValue?: string;
  enableHover?: boolean;
}

export const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({
  children,
  className = "",
  defaultValue,
  enableHover = false,
}) => {
  const [activeId, setActiveId] = useState(defaultValue || "");

  return (
    <>
      {React.Children.map(children, (child, index) => {
        if (!React.isValidElement<{ "data-id"?: string; name?: string }>(child)) {
          return child;
        }

        const dataId = child.props["data-id"] || child.props.name || `item-${index}`;
        const isActive = activeId === dataId;

        return (
          <div
            key={dataId}
            onMouseEnter={enableHover ? () => setActiveId(dataId) : undefined}
            onFocus={enableHover ? () => setActiveId(dataId) : undefined}
            className="relative overflow-hidden rounded-lg"
          >
            <span
              aria-hidden="true"
              className={`absolute inset-0 z-0 transition-all duration-300 ${
                isActive ? "scale-100 opacity-100" : "scale-95 opacity-0"
              } ${className}`}
            />
            <span className="relative z-10 block h-full">{child}</span>
          </div>
        );
      })}
    </>
  );
};
