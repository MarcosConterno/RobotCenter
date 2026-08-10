import RobotProductListPage from "@/components/robos/RobotProductListPage";
import { ROBOT_PRODUCTS } from "@/domain/robot-products";

export default function PeticionamentoPage() {
  return <RobotProductListPage product={ROBOT_PRODUCTS[2]} />;
}
