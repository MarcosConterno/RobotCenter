import RobotCard from "./RobotCard";
import type { Robo } from "@/domain/entities";

interface RobotTableProps {
  robots: Robo[];
  selectedRobot: Robo | null;
  onSelectRobot: (robot: Robo) => void;
}

export default function RobotTable({
  robots,
  selectedRobot,
  onSelectRobot,
}: RobotTableProps) {
  return (
    <div
      data-tour="robots-list"
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
