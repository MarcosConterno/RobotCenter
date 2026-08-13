import AppShell from "@/components/layout/AppShell";
import RobotFormRoute from "@/components/robos/RobotFormRoute";
import type { TipoProdutoRobo } from "@/domain/entities";
import { ROBOT_PRODUCTS } from "@/domain/robot-products";

export default async function NewRobotPage({ searchParams }: { searchParams: Promise<{ product?: string; copiarDe?: string }> }) {
  const { product: requestedProduct, copiarDe: copySourceId } = await searchParams;
  const productType = (ROBOT_PRODUCTS.some((product) => product.productType === requestedProduct) ? requestedProduct : "INTEGRADOR") as TipoProdutoRobo;
  return <AppShell title="Robôs"><RobotFormRoute mode="create" copySourceId={copySourceId} defaultProductType={productType} /></AppShell>;
}
