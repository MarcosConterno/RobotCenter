import RobotProductListPage from "@/components/robos/RobotProductListPage";
import { ROBOT_PRODUCTS } from "@/domain/robot-products";

export default function ConsultaProcessualPage() {
  return <RobotProductListPage product={ROBOT_PRODUCTS[1]} />;
}
