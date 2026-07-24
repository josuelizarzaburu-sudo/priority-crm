// Tarifas 2026 de GASTOS MÉDICOS MAYORES (GMM) — Humana Proteger y Confiamed GMM.
// BMI GMM vive en bmi-tarifas.ts (ya existía); este archivo cubre las otras dos aseguradoras.
//
// FUENTES (extraídas de los cotizadores oficiales):
//   · Humana Proteger  -> Cotizador_Humana_base_2026_Master.xlsm, hoja "Plan Proteger"
//   · Confiamed GMM    -> COTIZADOR_V_6_8_Tarifas_2026.xlsm, hoja oculta "CODEX" (filas 46-64)

// ══════════════════════════════════════════════════════════════════
//  HUMANA — PLAN PROTEGER
// ══════════════════════════════════════════════════════════════════
// 3 variantes que se diferencian solo por el deducible anual; cobertura USD 500.000 en las tres.
// Lógica (validada al centavo contra el ejemplo del propio Excel, 3 personas 37M/35F/8F):
//   suma de precios por persona -> + 0,5% seguro campesino. NO hay descuento familiar
//   (la fila "Ajuste Tarifa familiar" del cotizador oficial viene vacía).

export type ProtegerPlan = 'F' | 'G' | 'H'
export type SexoP = 'M' | 'F'

export const PROTEGER_PLANES: ProtegerPlan[] = ['F', 'G', 'H']

export const PROTEGER_PLAN_LABEL: Record<ProtegerPlan, string> = {
  F: 'Proteger F',
  G: 'Proteger G',
  H: 'Proteger H',
}

// Deducible anual de cada variante
export const PROTEGER_DEDUCIBLE: Record<ProtegerPlan, number> = {
  F: 5000,
  G: 10000,
  H: 20000,
}

export const PROTEGER_DEDUCIBLE_LABEL: Record<ProtegerPlan, string> = {
  F: 'USD 5.000',
  G: 'USD 10.000',
  H: 'USD 20.000',
}

const SEGURO_CAMPESINO_PROTEGER = 0.005

// Precio mensual por persona: clave "edad+sexo" (ej "37M") -> precio por variante.
export const PROTEGER_TARIFAS: Record<string, Record<ProtegerPlan, number>> = {"0F":{"F":8.09,"G":5.42,"H":4.07},"1F":{"F":8.09,"G":5.42,"H":4.07},"2F":{"F":8.09,"G":5.43,"H":4.07},"3F":{"F":8.09,"G":5.43,"H":4.07},"4F":{"F":8.09,"G":5.43,"H":4.07},"5F":{"F":8.09,"G":5.43,"H":4.07},"6F":{"F":8.09,"G":5.43,"H":4.07},"7F":{"F":8.09,"G":5.43,"H":4.07},"8F":{"F":8.09,"G":5.43,"H":4.07},"9F":{"F":8.09,"G":5.43,"H":4.07},"10F":{"F":8.09,"G":5.43,"H":4.07},"11F":{"F":9.12,"G":6.12,"H":4.58},"12F":{"F":9.12,"G":6.12,"H":4.58},"13F":{"F":9.12,"G":6.12,"H":4.58},"14F":{"F":9.12,"G":6.12,"H":4.58},"15F":{"F":9.12,"G":6.12,"H":4.58},"16F":{"F":9.12,"G":6.12,"H":4.58},"17F":{"F":9.12,"G":6.12,"H":4.58},"18F":{"F":19.42,"G":11.23,"H":10.38},"19F":{"F":19.42,"G":11.46,"H":10.59},"20F":{"F":19.38,"G":13.7,"H":10.59},"21F":{"F":19.45,"G":13.72,"H":10.6},"22F":{"F":20.27,"G":14.3,"H":11.03},"23F":{"F":21.31,"G":15.16,"H":11.68},"24F":{"F":22.33,"G":16.02,"H":12.33},"25F":{"F":24.43,"G":17.19,"H":13.21},"26F":{"F":25.69,"G":18.07,"H":13.86},"27F":{"F":26.95,"G":18.95,"H":14.53},"28F":{"F":28.21,"G":19.82,"H":15.18},"29F":{"F":29.47,"G":20.7,"H":15.84},"30F":{"F":30.72,"G":21.58,"H":16.5},"31F":{"F":31.98,"G":22.46,"H":17.16},"32F":{"F":33.23,"G":23.33,"H":17.81},"33F":{"F":34.49,"G":24.21,"H":18.47},"34F":{"F":35.74,"G":25.09,"H":19.13},"35F":{"F":37.0,"G":25.96,"H":19.79},"36F":{"F":38.19,"G":26.83,"H":20.44},"37F":{"F":39.87,"G":28.01,"H":21.32},"38F":{"F":41.51,"G":29.16,"H":22.18},"39F":{"F":42.79,"G":30.05,"H":22.85},"40F":{"F":44.07,"G":30.94,"H":23.52},"41F":{"F":45.34,"G":31.83,"H":24.19},"42F":{"F":46.62,"G":32.73,"H":24.86},"43F":{"F":47.89,"G":33.62,"H":25.53},"44F":{"F":49.17,"G":34.51,"H":26.2},"45F":{"F":50.44,"G":35.41,"H":26.87},"46F":{"F":51.72,"G":36.3,"H":27.54},"47F":{"F":52.97,"G":37.19,"H":28.21},"48F":{"F":54.18,"G":38.44,"H":29.14},"49F":{"F":55.52,"G":39.01,"H":29.57},"50F":{"F":59.75,"G":40.4,"H":30.61},"51F":{"F":62.69,"G":42.37,"H":32.09},"52F":{"F":67.01,"G":45.26,"H":34.26},"53F":{"F":72.29,"G":48.8,"H":36.91},"54F":{"F":76.56,"G":51.65,"H":39.05},"55F":{"F":81.07,"G":54.67,"H":41.32},"56F":{"F":85.86,"G":57.88,"H":43.72},"57F":{"F":90.85,"G":61.28,"H":46.27},"58F":{"F":97.32,"G":64.99,"H":49.05},"59F":{"F":101.3,"G":66.99,"H":50.56},"60F":{"F":105.31,"G":68.96,"H":52.04},"61F":{"F":109.47,"G":70.99,"H":53.56},"62F":{"F":113.79,"G":73.08,"H":55.13},"63F":{"F":118.3,"G":75.24,"H":56.74},"64F":{"F":122.98,"G":77.46,"H":58.41},"65F":{"F":135.79,"G":84.67,"H":63.82},"66F":{"F":150.87,"G":93.13,"H":70.16},"67F":{"F":162.62,"G":100.27,"H":75.51},"68F":{"F":169.07,"G":103.24,"H":77.74},"69F":{"F":175.79,"G":106.3,"H":80.04},"70F":{"F":182.77,"G":109.45,"H":82.4},"71F":{"F":190.03,"G":112.7,"H":84.84},"72F":{"F":197.58,"G":116.04,"H":87.34},"73F":{"F":205.43,"G":119.48,"H":89.93},"74F":{"F":213.6,"G":123.03,"H":92.59},"75F":{"F":222.09,"G":126.68,"H":95.32},"76F":{"F":230.93,"G":130.44,"H":98.15},"77F":{"F":240.12,"G":134.32,"H":101.06},"78F":{"F":249.67,"G":138.31,"H":104.05},"79F":{"F":259.61,"G":142.43,"H":107.13},"80F":{"F":269.94,"G":120.49,"H":110.31},"81F":{"F":280.69,"G":151.02,"H":113.58},"82F":{"F":291.87,"G":155.52,"H":116.95},"83F":{"F":303.49,"G":160.14,"H":120.42},"84F":{"F":315.58,"G":164.91,"H":124.0},"85F":{"F":328.16,"G":169.82,"H":127.68},"86F":{"F":328.16,"G":169.82,"H":127.68},"87F":{"F":328.16,"G":169.82,"H":127.68},"88F":{"F":328.16,"G":169.82,"H":127.68},"89F":{"F":328.16,"G":169.82,"H":127.68},"90F":{"F":328.16,"G":169.82,"H":127.68},"91F":{"F":328.16,"G":169.82,"H":127.68},"92F":{"F":328.16,"G":169.82,"H":127.68},"93F":{"F":328.16,"G":169.82,"H":127.68},"94F":{"F":328.16,"G":169.82,"H":127.68},"95F":{"F":328.16,"G":169.82,"H":127.68},"96F":{"F":328.16,"G":169.82,"H":127.68},"97F":{"F":328.16,"G":169.82,"H":127.68},"98F":{"F":328.16,"G":169.82,"H":127.68},"99F":{"F":328.16,"G":169.82,"H":127.68},"0M":{"F":8.09,"G":5.42,"H":4.07},"1M":{"F":8.09,"G":5.42,"H":4.07},"2M":{"F":8.09,"G":5.43,"H":4.07},"3M":{"F":8.09,"G":5.43,"H":4.07},"4M":{"F":8.09,"G":5.43,"H":4.07},"5M":{"F":8.09,"G":5.43,"H":4.07},"6M":{"F":8.09,"G":5.43,"H":4.07},"7M":{"F":8.09,"G":5.43,"H":4.07},"8M":{"F":8.09,"G":5.43,"H":4.07},"9M":{"F":8.09,"G":5.43,"H":4.07},"10M":{"F":8.09,"G":5.43,"H":4.07},"11M":{"F":9.12,"G":6.12,"H":4.58},"12M":{"F":9.12,"G":6.12,"H":4.58},"13M":{"F":9.12,"G":6.12,"H":4.58},"14M":{"F":9.12,"G":6.12,"H":4.58},"15M":{"F":9.12,"G":6.12,"H":4.58},"16M":{"F":9.12,"G":6.12,"H":4.58},"17M":{"F":9.12,"G":6.12,"H":4.58},"18M":{"F":19.42,"G":11.23,"H":10.38},"19M":{"F":19.42,"G":11.46,"H":10.59},"20M":{"F":19.38,"G":13.7,"H":10.59},"21M":{"F":19.45,"G":13.72,"H":10.6},"22M":{"F":20.27,"G":14.3,"H":11.03},"23M":{"F":21.31,"G":15.16,"H":11.68},"24M":{"F":22.33,"G":16.02,"H":12.33},"25M":{"F":24.43,"G":17.19,"H":13.21},"26M":{"F":25.69,"G":18.07,"H":13.86},"27M":{"F":26.95,"G":18.95,"H":14.53},"28M":{"F":28.21,"G":19.82,"H":15.18},"29M":{"F":29.47,"G":20.7,"H":15.84},"30M":{"F":30.72,"G":21.58,"H":16.5},"31M":{"F":31.98,"G":22.46,"H":17.16},"32M":{"F":33.23,"G":23.33,"H":17.81},"33M":{"F":34.49,"G":24.21,"H":18.47},"34M":{"F":35.74,"G":25.09,"H":19.13},"35M":{"F":37.0,"G":25.96,"H":19.79},"36M":{"F":38.19,"G":26.83,"H":20.44},"37M":{"F":39.87,"G":28.01,"H":21.32},"38M":{"F":41.51,"G":29.16,"H":22.18},"39M":{"F":42.79,"G":30.05,"H":22.85},"40M":{"F":44.07,"G":30.94,"H":23.52},"41M":{"F":45.34,"G":31.83,"H":24.19},"42M":{"F":46.62,"G":32.73,"H":24.86},"43M":{"F":47.89,"G":33.62,"H":25.53},"44M":{"F":49.17,"G":34.51,"H":26.2},"45M":{"F":50.44,"G":35.41,"H":26.87},"46M":{"F":51.72,"G":36.3,"H":27.54},"47M":{"F":52.97,"G":37.19,"H":28.21},"48M":{"F":54.18,"G":38.44,"H":29.14},"49M":{"F":55.52,"G":39.01,"H":29.57},"50M":{"F":59.75,"G":40.4,"H":30.61},"51M":{"F":62.69,"G":42.37,"H":32.09},"52M":{"F":67.01,"G":45.26,"H":34.26},"53M":{"F":72.29,"G":48.8,"H":36.91},"54M":{"F":76.56,"G":51.65,"H":39.05},"55M":{"F":81.07,"G":54.67,"H":41.32},"56M":{"F":85.86,"G":57.88,"H":43.72},"57M":{"F":90.85,"G":61.28,"H":46.27},"58M":{"F":97.32,"G":64.99,"H":49.05},"59M":{"F":101.3,"G":66.99,"H":50.56},"60M":{"F":105.31,"G":68.96,"H":52.04},"61M":{"F":109.47,"G":70.99,"H":53.56},"62M":{"F":113.79,"G":73.08,"H":55.13},"63M":{"F":118.3,"G":75.24,"H":56.74},"64M":{"F":122.98,"G":77.46,"H":58.41},"65M":{"F":135.79,"G":84.67,"H":63.82},"66M":{"F":150.87,"G":93.13,"H":70.16},"67M":{"F":162.62,"G":100.27,"H":75.51},"68M":{"F":169.07,"G":103.24,"H":77.74},"69M":{"F":175.79,"G":106.3,"H":80.04},"70M":{"F":182.77,"G":109.45,"H":82.4},"71M":{"F":190.03,"G":112.7,"H":84.84},"72M":{"F":197.58,"G":116.04,"H":87.34},"73M":{"F":205.43,"G":119.48,"H":89.93},"74M":{"F":213.6,"G":123.03,"H":92.59},"75M":{"F":222.09,"G":126.68,"H":95.32},"76M":{"F":230.93,"G":130.44,"H":98.15},"77M":{"F":240.12,"G":134.32,"H":101.06},"78M":{"F":249.67,"G":138.31,"H":104.05},"79M":{"F":259.61,"G":142.43,"H":107.13},"80M":{"F":269.94,"G":120.49,"H":110.31},"81M":{"F":280.69,"G":151.02,"H":113.58},"82M":{"F":291.87,"G":155.52,"H":116.95},"83M":{"F":303.49,"G":160.14,"H":120.42},"84M":{"F":315.58,"G":164.91,"H":124.0},"85M":{"F":328.16,"G":169.82,"H":127.68},"86M":{"F":328.16,"G":169.82,"H":127.68},"87M":{"F":328.16,"G":169.82,"H":127.68},"88M":{"F":328.16,"G":169.82,"H":127.68},"89M":{"F":328.16,"G":169.82,"H":127.68},"90M":{"F":328.16,"G":169.82,"H":127.68},"91M":{"F":328.16,"G":169.82,"H":127.68},"92M":{"F":328.16,"G":169.82,"H":127.68},"93M":{"F":328.16,"G":169.82,"H":127.68},"94M":{"F":328.16,"G":169.82,"H":127.68},"95M":{"F":328.16,"G":169.82,"H":127.68},"96M":{"F":328.16,"G":169.82,"H":127.68},"97M":{"F":328.16,"G":169.82,"H":127.68},"98M":{"F":328.16,"G":169.82,"H":127.68},"99M":{"F":328.16,"G":169.82,"H":127.68}}

export interface ProtegerPersona {
  edad: number
  sexo: SexoP
}

export interface ProtegerResultado {
  plan: ProtegerPlan
  label: string
  deducible: number
  deducibleLabel: string
  subtotal: number // suma mensual de la familia, antes de impuesto
  mensual: number // subtotal + seguro campesino
  anual: number
}

// Precio de una persona en una variante (clamp edad 0..99, igual que el VLOOKUP del Excel)
function precioPersonaProteger(persona: ProtegerPersona, plan: ProtegerPlan): number {
  const e = Math.max(0, Math.min(99, Math.round(persona.edad)))
  const fila = PROTEGER_TARIFAS[`${e}${persona.sexo}`]
  return fila ? fila[plan] : 0
}

// Cotiza las 3 variantes de Proteger para una familia.
export function cotizarProteger(personas: ProtegerPersona[]): ProtegerResultado[] {
  const r2 = (n: number) => Math.round(n * 100) / 100
  return PROTEGER_PLANES.map((plan) => {
    const subtotal = personas.reduce((s, p) => s + precioPersonaProteger(p, plan), 0)
    const mensual = subtotal * (1 + SEGURO_CAMPESINO_PROTEGER)
    return {
      plan,
      label: PROTEGER_PLAN_LABEL[plan],
      deducible: PROTEGER_DEDUCIBLE[plan],
      deducibleLabel: PROTEGER_DEDUCIBLE_LABEL[plan],
      subtotal: r2(subtotal),
      mensual: r2(mensual),
      anual: r2(mensual * 12),
    }
  })
}

// ══════════════════════════════════════════════════════════════════
//  CONFIAMED — GMM (GASTOS MÉDICOS MAYORES)
// ══════════════════════════════════════════════════════════════════
// 2 deducibles (5.000 = "GMM UNO", 10.000 = "GMM DOS"), ambos con cobertura USD 500.000.
// El tarifario distingue VENTA NUEVA de RENOVACIÓN, y precio por género. No hay
// dimensión de maternidad (a diferencia de CONFIPLUS) ni descuento por familia.
// Los precios de CODEX ya vienen con impuestos incluidos (igual que CONFIPLUS).

export type ConfiamedGmmDeducible = '5000' | '10000'
export type ConfiamedGmmVenta = 'nueva' | 'renov'
export type SexoCG = 'M' | 'F'

export const CONFIAMED_GMM_DEDUCIBLES: ConfiamedGmmDeducible[] = ['5000', '10000']

export const CONFIAMED_GMM_DEDUCIBLE_LABEL: Record<ConfiamedGmmDeducible, string> = {
  '5000': 'USD 5.000',
  '10000': 'USD 10.000',
}

// Nombre comercial de cada deducible en la póliza
export const CONFIAMED_GMM_PRODUCTO: Record<ConfiamedGmmDeducible, string> = {
  '5000': 'Gastos Médicos Mayores UNO',
  '10000': 'Gastos Médicos Mayores DOS',
}

interface RangoGmm {
  desde: number
  hasta: number
  precios: Record<string, number | null>
}

// Rangos de edad -> precios por (tipo de venta × deducible × género)
export const CONFIAMED_GMM_TARIFAS: RangoGmm[] = [{"desde":0,"hasta":0,"precios":{"nueva_5000_M":19.7752,"nueva_5000_F":23.2128,"nueva_10000_M":15.7201,"nueva_10000_F":17.9471,"renov_5000_M":21.2134,"renov_5000_F":22.7908,"renov_10000_M":15.7201,"renov_10000_F":17.6208}},{"desde":1,"hasta":17,"precios":{"nueva_5000_M":18.8763,"nueva_5000_F":22.1577,"nueva_10000_M":14.6072,"nueva_10000_F":15.4998,"renov_5000_M":18.5168,"renov_5000_F":22.1577,"renov_10000_M":14.6072,"renov_10000_F":14.684}},{"desde":18,"hasta":24,"precios":{"nueva_5000_M":20.4322,"nueva_5000_F":24.7305,"nueva_10000_M":14.7875,"nueva_10000_F":16.5027,"renov_5000_M":17.0075,"renov_5000_F":23.6064,"renov_10000_M":13.3972,"renov_10000_F":15.6341}},{"desde":25,"hasta":29,"precios":{"nueva_5000_M":21.276,"nueva_5000_F":31.4961,"nueva_10000_M":15.3801,"nueva_10000_F":21.7929,"renov_5000_M":17.7099,"renov_5000_F":29.8384,"renov_10000_M":13.6712,"renov_10000_F":20.511}},{"desde":30,"hasta":34,"precios":{"nueva_5000_M":26.7155,"nueva_5000_F":35.6256,"nueva_10000_M":19.331,"nueva_10000_F":25.9042,"renov_5000_M":22.2377,"renov_5000_F":33.53,"renov_10000_M":16.4671,"renov_10000_F":24.2852}},{"desde":35,"hasta":39,"precios":{"nueva_5000_M":33.5112,"nueva_5000_F":41.0084,"nueva_10000_M":24.2554,"nueva_10000_F":30.0265,"renov_5000_M":27.8943,"renov_5000_F":36.6917,"renov_10000_M":20.662,"renov_10000_F":28.3584}},{"desde":40,"hasta":44,"precios":{"nueva_5000_M":41.7533,"nueva_5000_F":46.4116,"nueva_10000_M":29.0911,"nueva_10000_F":34.1571,"renov_5000_M":34.755,"renov_5000_F":41.9914,"renov_10000_M":25.7344,"renov_10000_F":32.4493}},{"desde":45,"hasta":49,"precios":{"nueva_5000_M":52.6776,"nueva_5000_F":55.7959,"nueva_10000_M":36.7273,"nueva_10000_F":37.5122,"renov_5000_M":43.8482,"renov_5000_F":50.9441,"renov_10000_M":32.4895,"renov_10000_F":35.6366}},{"desde":50,"hasta":54,"precios":{"nueva_5000_M":67.4426,"nueva_5000_F":68.494,"nueva_10000_M":48.399,"nueva_10000_F":44.1283,"renov_5000_M":55.3993,"renov_5000_F":59.9323,"renov_10000_M":42.8145,"renov_10000_F":41.9219}},{"desde":55,"hasta":59,"precios":{"nueva_5000_M":87.6358,"nueva_5000_F":79.2053,"nueva_10000_M":62.897,"nueva_10000_F":53.567,"renov_5000_M":71.9866,"renov_5000_F":69.3046,"renov_10000_M":55.6397,"renov_10000_F":51.0162}},{"desde":60,"hasta":62,"precios":{"nueva_5000_M":112.4531,"nueva_5000_F":106.0805,"nueva_10000_M":86.9042,"nueva_10000_F":75.8946,"renov_5000_M":94.7819,"renov_5000_F":92.7222,"renov_10000_M":73.2478,"renov_10000_F":69.823}},{"desde":63,"hasta":65,"precios":{"nueva_5000_M":114.8628,"nueva_5000_F":108.4378,"nueva_10000_M":88.7664,"nueva_10000_F":88.0377,"renov_5000_M":96.3883,"renov_5000_F":94.2938,"renov_10000_M":74.4893,"renov_10000_F":72.8588}},{"desde":66,"hasta":68,"precios":{"nueva_5000_M":146.3719,"nueva_5000_F":132.6218,"nueva_10000_M":115.3796,"nueva_10000_F":112.3015,"renov_5000_M":123.3706,"renov_5000_F":115.9213,"renov_10000_M":97.2485,"renov_10000_F":90.6157}},{"desde":69,"hasta":71,"precios":{"nueva_5000_M":149.5084,"nueva_5000_F":135.5689,"nueva_10000_M":117.852,"nueva_10000_F":114.625,"renov_5000_M":125.4616,"renov_5000_F":117.886,"renov_10000_M":98.8968,"renov_10000_F":92.9392}},{"desde":72,"hasta":74,"precios":{"nueva_5000_M":175.3741,"nueva_5000_F":156.3833,"nueva_10000_M":138.2507,"nueva_10000_F":123.2949,"renov_5000_M":150.3207,"renov_5000_F":139.0074,"renov_10000_M":118.5006,"renov_10000_F":109.5955}},{"desde":75,"hasta":79,"precios":{"nueva_5000_M":207.1419,"nueva_5000_F":181.6124,"nueva_10000_M":163.302,"nueva_10000_F":143.1762,"renov_5000_M":177.5502,"renov_5000_F":161.4332,"renov_10000_M":139.9732,"renov_10000_F":127.2677}},{"desde":80,"hasta":84,"precios":{"nueva_5000_M":238.1049,"nueva_5000_F":208.2242,"nueva_10000_M":187.6949,"nueva_10000_F":164.144,"renov_5000_M":204.0899,"renov_5000_F":185.0882,"renov_10000_M":160.8814,"renov_10000_F":145.9057}},{"desde":85,"hasta":100,"precios":{"nueva_5000_M":272.5066,"nueva_5000_F":237.6863,"nueva_10000_M":214.8241,"nueva_10000_F":187.3835,"renov_5000_M":233.5771,"renov_5000_F":211.2767,"renov_10000_M":184.135,"renov_10000_F":166.5631}}]

export interface ConfiamedGmmPersona {
  edad: number
  sexo: SexoCG
}

export interface ConfiamedGmmResultado {
  deducible: ConfiamedGmmDeducible
  label: string
  producto: string
  venta: ConfiamedGmmVenta
  mensual: number
  anual: number
}

// Precio de una persona: ubica el rango de edad y arma la clave venta_deducible_sexo.
function precioPersonaGmm(
  deducible: ConfiamedGmmDeducible,
  persona: ConfiamedGmmPersona,
  venta: ConfiamedGmmVenta,
): number {
  const edad = Math.max(0, Math.round(persona.edad))
  const rango =
    CONFIAMED_GMM_TARIFAS.find((r) => edad >= r.desde && edad <= r.hasta) ??
    CONFIAMED_GMM_TARIFAS[CONFIAMED_GMM_TARIFAS.length - 1]
  return rango.precios[`${venta}_${deducible}_${persona.sexo}`] ?? 0
}

// Cotiza un deducible de GMM para una familia (suma directa, sin descuentos).
export function cotizarConfiamedGmmDeducible(
  deducible: ConfiamedGmmDeducible,
  personas: ConfiamedGmmPersona[],
  venta: ConfiamedGmmVenta,
): ConfiamedGmmResultado {
  const r2 = (n: number) => Math.round(n * 100) / 100
  const mensual = personas.reduce((s, p) => s + precioPersonaGmm(deducible, p, venta), 0)
  return {
    deducible,
    label: CONFIAMED_GMM_DEDUCIBLE_LABEL[deducible],
    producto: CONFIAMED_GMM_PRODUCTO[deducible],
    venta,
    mensual: r2(mensual),
    anual: r2(mensual * 12),
  }
}

// Cotiza los 2 deducibles de GMM para un tipo de venta dado.
export function cotizarConfiamedGmm(
  personas: ConfiamedGmmPersona[],
  venta: ConfiamedGmmVenta,
): ConfiamedGmmResultado[] {
  return CONFIAMED_GMM_DEDUCIBLES.map((d) => cotizarConfiamedGmmDeducible(d, personas, venta))
}
