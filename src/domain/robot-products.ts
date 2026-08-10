import type { TipoProdutoRobo } from "@/domain/entities";

export interface RobotProductDefinition {
  productType: TipoProdutoRobo;
  slug: string;
  label: string;
  description: string;
  requiresTribunal: boolean;
}

export const ROBOT_PRODUCTS: readonly RobotProductDefinition[] = [
  { productType: "INTEGRADOR", slug: "integradores", label: "Robôs Integradores", description: "Robôs de integração entre sistemas.", requiresTribunal: false },
  { productType: "CONSULTA_PROCESSUAL", slug: "consulta-processual", label: "Consulta Processual", description: "Robôs de consulta nos sistemas dos tribunais.", requiresTribunal: true },
  { productType: "PETICIONAMENTO", slug: "peticionamento", label: "Peticionamento", description: "Robôs de peticionamento nos tribunais.", requiresTribunal: true },
  { productType: "MOVIMENTO", slug: "movimento", label: "Movimento", description: "Robôs de movimentação processual.", requiresTribunal: true },
] as const;

export function getRobotProductByType(productType: TipoProdutoRobo) {
  return ROBOT_PRODUCTS.find((product) => product.productType === productType) ?? ROBOT_PRODUCTS[0];
}

export function getRobotProductBySlug(slug: string) {
  return ROBOT_PRODUCTS.find((product) => product.slug === slug);
}

export function getRobotProductPath(productType: TipoProdutoRobo) {
  return `/robos/${getRobotProductByType(productType).slug}`;
}
