// Ejemplos de categoría, marca y un producto de muestra para los
// placeholders y plantillas del inventario, según el tipo de negocio de la
// empresa — así "Ej. Jabones, Detergentes" tiene sentido para una tienda de
// aseo, pero no para una cafetería. Puramente cosmético (no cambia qué se
// guarda ni el esquema).
type EjemploNegocio = {
  categoria: string;
  marca: string;
  producto: { nombre: string; categoria: string; costo: number; precioVenta: number };
};

const EJEMPLOS: Record<string, EjemploNegocio> = {
  aseo: {
    categoria: "Jabones, Detergentes",
    marca: "Fabuloso, Familia",
    producto: { nombre: "Jabón líquido para platos 500ml", categoria: "Cocina", costo: 3500, precioVenta: 6000 },
  },
  ropa: {
    categoria: "Camisetas, Pantalones",
    marca: "Chevignon, Tennis",
    producto: { nombre: "Camiseta cuello redondo talla M", categoria: "Camisetas", costo: 25000, precioVenta: 45000 },
  },
  restaurante: {
    categoria: "Entradas, Platos fuertes",
    marca: "Alpina, Zenú",
    producto: { nombre: "Bandeja paisa", categoria: "Platos fuertes", costo: 8000, precioVenta: 22000 },
  },
  cafeteria: {
    categoria: "Bebidas calientes, Panadería",
    marca: "Juan Valdez, Colcafé",
    producto: { nombre: "Café americano 12oz", categoria: "Bebidas calientes", costo: 1500, precioVenta: 4500 },
  },
  belleza: {
    categoria: "Cuidado facial, Maquillaje",
    marca: "L'Oréal, Nivea",
    producto: { nombre: "Crema hidratante facial 100ml", categoria: "Cuidado facial", costo: 12000, precioVenta: 25000 },
  },
  ferreteria: {
    categoria: "Herramientas, Tornillería",
    marca: "Stanley, Truper",
    producto: { nombre: "Martillo de uña 16oz", categoria: "Herramientas", costo: 15000, precioVenta: 28000 },
  },
  taller: {
    categoria: "Repuestos, Lubricantes",
    marca: "Bosch, Castrol",
    producto: { nombre: "Aceite de motor 4T 1L", categoria: "Lubricantes", costo: 18000, precioVenta: 32000 },
  },
  tienda: {
    categoria: "Snacks, Bebidas",
    marca: "Postobón, Ramo",
    producto: { nombre: "Gaseosa 400ml", categoria: "Bebidas", costo: 1800, precioVenta: 3000 },
  },
  papeleria: {
    categoria: "Cuadernos, Esferos",
    marca: "Norma, Scribe",
    producto: { nombre: "Cuaderno cuadriculado 100 hojas", categoria: "Cuadernos", costo: 3500, precioVenta: 6500 },
  },
};

const EJEMPLO_POR_DEFECTO: EjemploNegocio = {
  categoria: "Categoría",
  marca: "Marca",
  producto: { nombre: "Jabón líquido para platos 500ml", categoria: "Cocina", costo: 3500, precioVenta: 6000 },
};

export function ejemplosInventario(tipoNegocio: string | null): EjemploNegocio {
  return (tipoNegocio && EJEMPLOS[tipoNegocio]) || EJEMPLO_POR_DEFECTO;
}
