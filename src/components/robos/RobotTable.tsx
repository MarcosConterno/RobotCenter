import RobotCard from "./RobotCard";
import type { Robot } from "@/types/robot";

interface RobotTableProps {
  robots: Robot[];
  selectedRobot: Robot | null;
  onSelectRobot: (robot: Robot) => void;
}

export default function RobotTable({
  robots,
  selectedRobot,
  onSelectRobot,
}: RobotTableProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 12,
      }}
    >
      {robots.map((robot) => (
        <RobotCard
          key={robot.id}
          robot={robot}
          selected={selectedRobot?.id === robot.id}
          onClick={() => onSelectRobot(robot)}
        />
      ))}
    </div>
  );
}