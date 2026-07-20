// Catálogo de planes para la sección Comparativos.
// Generado desde los Excel de comparativos 2026. Para actualizar valores,
// editar este archivo o regenerar desde los Excel fuente.
// 'salud' fusiona los antiguos catálogos 'abierta' y 'cerrada' en uno solo;
// cada plan conserva su campo `network` ('abierta' | 'cerrada') para mostrar
// el badge de red médica en la UI.

export interface CatalogPlan {
  id: string
  name: string
  insurer: string
  network?: 'abierta' | 'cerrada'
}

export interface CatalogBenefit {
  label: string
  values: (string | null)[]
}

export interface Catalog {
  plans: CatalogPlan[]
  benefits: CatalogBenefit[]
}

export type CatalogKey = 'salud' | 'internacional' | 'vehiculos'

export const CATALOGS: Record<CatalogKey, Catalog> = {
  "salud": {
    "plans": [
      {
        "id": "ab0",
        "name": "BMI SIGMA",
        "insurer": "BMI",
        "network": "abierta"
      },
      {
        "id": "ab1",
        "name": "BMI INNOVA",
        "insurer": "BMI",
        "network": "abierta"
      },
      {
        "id": "ab2",
        "name": "BMI GMM",
        "insurer": "BMI",
        "network": "abierta"
      },
      {
        "id": "ab3",
        "name": "HUMANA 50",
        "insurer": "Humana",
        "network": "abierta"
      },
      {
        "id": "ab4",
        "name": "HUMANA 80",
        "insurer": "Humana",
        "network": "abierta"
      },
      {
        "id": "ab5",
        "name": "CONFIAMED 30",
        "insurer": "Confiamed",
        "network": "abierta"
      },
      {
        "id": "ab6",
        "name": "CONFIAMED 60",
        "insurer": "Confiamed",
        "network": "abierta"
      },
      {
        "id": "ab7",
        "name": "CONFIAMED 110",
        "insurer": "Confiamed",
        "network": "abierta"
      },
      {
        "id": "ab8",
        "name": "SALUD SKY 50",
        "insurer": "Saludsa",
        "network": "abierta"
      },
      {
        "id": "ab9",
        "name": "SALUD SKY 70",
        "insurer": "Saludsa",
        "network": "abierta"
      },
      {
        "id": "ab10",
        "name": "SALUD PRO 150",
        "insurer": "Saludsa",
        "network": "abierta"
      },
      {
        "id": "ab11",
        "name": "BUPA CUIDADO TOTAL 40",
        "insurer": "Bupa",
        "network": "abierta"
      },
      {
        "id": "ab12",
        "name": "BUPA CUIDADO TOTAL PLUS 60",
        "insurer": "Bupa",
        "network": "abierta"
      },
      {
        "id": "ab13",
        "name": "BUPA CUIDADO TOTAL PREMIUM 130",
        "insurer": "Bupa",
        "network": "abierta"
      },
      {
        "id": "ce0",
        "name": "HUMANA 15",
        "insurer": "Humana",
        "network": "cerrada"
      },
      {
        "id": "ce1",
        "name": "HUMANA 30",
        "insurer": "Humana",
        "network": "cerrada"
      },
      {
        "id": "ce2",
        "name": "CONFIAMED 10",
        "insurer": "Confiamed",
        "network": "cerrada"
      },
      {
        "id": "ce3",
        "name": "SALUD STAR 15",
        "insurer": "Saludsa",
        "network": "cerrada"
      },
      {
        "id": "ce4",
        "name": "SALUD STAR 30",
        "insurer": "Saludsa",
        "network": "cerrada"
      }
    ],
    "benefits": [
      {
        "label": "Monto de Cobertura",
        "values": [
          "USD. 150.000  por incapacidad",
          "USD. 120.000  por incapacidad",
          "USD 500.000 Por Incapacidad",
          "USD. 50.000  Por Incapacidad",
          "USD. 80.000  Por Incapacidad",
          "USD 30.000 Por Incapacidad",
          "USD 60.000 Por Incapacidad",
          "USD 110.000 Por Incapacidad",
          "USD 50.000 Por Incapacidad",
          "USD 70.000 Por Incapacidad",
          "USD 150.000 Por Incapacidad",
          "USD 40.000 por incapacidad",
          "USD 60.000 por incapacidad",
          "USD 130.000 Anual",
          "USD. 15.000  Anual",
          "USD. 30.000  Anual",
          "USD 10.000 por incapacidad",
          "USD 15.000 por enfermedad",
          "USD 30.000 por enfermedad"
        ]
      },
      {
        "label": "Deducible",
        "values": [
          "USD 250",
          "USD 250",
          "USD 5.000",
          "USD 80 anual",
          "USD 200 anual",
          "USD 150 anual",
          "USD 200 anual",
          "USD 250 anual",
          "USD 100 anual",
          "USD 100 anual",
          "USD 150 anual",
          "USD 200/500 anual",
          "USD 200/500 anual",
          "USD 200/500 anual",
          "USD 50 anual",
          "USD 60 anual",
          "USD 120 anual",
          "USD 70 anual",
          "USD 90 anual"
        ]
      },
      {
        "label": "Red Medica",
        "values": [
          "Libre Eleccion de Medicos y Hospitales en Ecuador y Red Medica en Colombia",
          "Libre Eleccion de Medicos y Hospitales en Ecuador y Red Medica en Colombia",
          "Libre Eleccion de Medicos y Hospitales en Ecuador. Red médica en Colombia y Navarra España.",
          "Red Medica Humana y libre eleccion",
          "Red Medica Humana y libre eleccion",
          "Red 1 Top y libre eleccion",
          "Red 1 Top y libre eleccion",
          "Red 1 Top y libre eleccion",
          "Red Medica SKY y libre eleccion. Navarra España",
          "Red Medica SKY y libre eleccion. Navarra España",
          "Red Medica PRO y libre elección Navarra España",
          "Red Plus",
          "Red Completa",
          "Red Completa y Universidad de Navarra",
          "Red direccionada Plan Practi Humana",
          "Red direccionada Plan Practi Humana",
          "Red Uno",
          "Red Medica Star",
          "Red Medica Star"
        ]
      },
      {
        "label": "Cobertura Hospitalaria Dentro de la Red",
        "values": [
          "80%",
          "80%",
          "100%",
          "90%",
          "80%",
          "90%",
          "90%",
          "90%",
          "90%",
          "100%",
          "100%",
          "0.9",
          "0.9",
          "0.9",
          "90%",
          "90%",
          "90%",
          "90%",
          "100%"
        ]
      },
      {
        "label": "Cobertura Hospitalaria Fuera de Red",
        "values": [
          "80%",
          "80%",
          "100%",
          "80%",
          "70%",
          "80%",
          "80%",
          "80%",
          "70%",
          "70%",
          "80%",
          "0.8",
          "0.8",
          "0.9",
          "80%",
          "80%",
          "80%",
          "N/A",
          "N/A"
        ]
      },
      {
        "label": "Cobertura Ambulatoria Dentro de la Red",
        "values": [
          "80%",
          "80%",
          "100%",
          "90%",
          "80%",
          "90%",
          "90%",
          "90%",
          "80%",
          "80%",
          "90%",
          "0.9",
          "0.9",
          "0.9",
          "80%",
          "80%",
          "90%",
          "70%",
          "80%"
        ]
      },
      {
        "label": "Cobertura Ambulatoria Fuera de Red",
        "values": [
          "80%",
          "80%",
          "100%",
          "80%",
          "70%",
          "80%",
          "80%",
          "80%",
          "70%",
          "70%",
          "80%",
          "0.8",
          "0.8",
          "0.9",
          "80%",
          "80%",
          "80%",
          "N/A",
          "N/A"
        ]
      },
      {
        "label": "Cuarto y Alimento",
        "values": [
          "USD 200 por día",
          "USD 200 por día",
          "Monto Total de Cobertura",
          "USD 160 por día",
          "USD 160 Por Día",
          "USD 180 Por día",
          "USD 180 Por día",
          "USD 250 Por día",
          "USD 180 Por día",
          "USD 180 Por día",
          "USD 250 por día",
          "USD 150 Por día",
          "USD 180 Por día",
          "USD 220 por día",
          "USD 160 Por Día",
          "USD 160 Por Día",
          "USD 150 Por día",
          "Hasta USD 150 al 90% en hospital de la Red",
          "Hasta USD 150 al 100% en hospital de la Red"
        ]
      },
      {
        "label": "Tope de Consulta",
        "values": [
          "USD 73",
          "USD 73",
          "USD 73",
          "USD 60",
          "USD 70",
          "USD 50",
          "USD 60",
          "USD 70",
          "USD 35",
          "USD 40",
          "USD 55",
          "USD 50",
          "USD 70",
          "USD 80",
          "USD 25",
          "USD 30",
          "USD 45",
          "25 USD",
          "25 USD"
        ]
      },
      {
        "label": "Limite de copago",
        "values": [
          "USD 8.000",
          "USD 10.000",
          "No Aplica",
          "No Posee",
          "No Posee",
          "No Posee",
          "No Posee",
          "No Posee",
          "No Posee",
          "No Posee",
          "No posee",
          "No Posee",
          "No Posee",
          "USD 10.000",
          "No Posee",
          "No Posee",
          "No Posee",
          "No posee",
          "No posee"
        ]
      },
      {
        "label": "Medicamentos",
        "values": [
          "80%",
          "90%",
          "100%",
          "70%",
          "70%",
          "80%",
          "80%",
          "80%",
          "60%",
          "70%",
          "70%",
          "0.9",
          "0.9",
          "0.9",
          "70%",
          "70%",
          "80%",
          "70% en red de convenio",
          "80% en red de convenio"
        ]
      },
      {
        "label": "Terapias Físicas y Respiratorias",
        "values": [
          "Hasta el monto total cobertura",
          "Hasta 25 terapias por incapacidad",
          "Hasta el monto total cobertura",
          "Hasta 15 sesiones por tipo de terapia",
          "Hasta 15 sesiones por tipo de terapia",
          "Hasta USD 1.000 solo en red no cubre red abierta",
          "Hasta USD 1.000 solo en red no cubre red abierta",
          "Hasta USD 1.000 solo en red no cubre red abierta",
          "Hasta 30 sesiones por tipo de terapia",
          "Hasta 30 sesiones por tipo de terapia",
          "Hasta 30 sesiones por tipo de terapia",
          "Hasta 10 sesiones por persona y por año",
          "Hasta 20 sesiones por persona y por año",
          "Hasta 25 sesiones por persona y por año",
          "Hasta 15 sesiones por tipo de terapia",
          "Hasta 15 sesiones por tipo de terapia",
          "Hasta USD 1.000 solo en red no cubre red abierta",
          "Hasta 30 sesiones por tipo de terapia",
          "Hasta 30 sesiones por tipo de terapia"
        ]
      },
      {
        "label": "Maternidad",
        "values": [
          "USD 2.000",
          "USD 1.000",
          "Hasta el monto total cobertura",
          "USD 2.500",
          "USD 4.000",
          "USD 1.000",
          "USD 1.500",
          "USD 2.000",
          "USD 2.500",
          "USD 3.000",
          "USD 4.000",
          "USD 2.000",
          "USD 3.000",
          "USD 3.500",
          "USD 750",
          "USD 1.500",
          "USD 800",
          "USD 1.000 en hospital de la Red",
          "USD 2.500 en hospital de la Red"
        ]
      },
      {
        "label": "Complicaciones de Maternidad",
        "values": [
          "USD 25.000",
          "USD 15.000",
          "USD 50.000",
          "USD 3.750",
          "USD 4.000",
          "Incluido en maternidad",
          "Incluido en maternidad",
          "Incluido en maternidad",
          "USD 2.000",
          "USD 2.000",
          "USD 20.000",
          "USD 10.000",
          "USD 15.000",
          "USD 20.000",
          "USD 1.125",
          "USD 2.250",
          "Incluido en maternidad",
          "USD 500 en hospital de la Red",
          "USD 1.000 en hospital de la Red"
        ]
      },
      {
        "label": "Complicaciones Recién Nacido",
        "values": [
          "Hasta el monto total de cobertura",
          "Hasta el monto total de cobertura",
          "Hasta el monto total de cobertura",
          "Hasta USD 50.000 con inclusion intrauterina",
          "Hasta USD 80.000 con inclusion intrauterina",
          "Hasta USD. 30.000 con inclusión intrauterina",
          "Hasta USD. 60.000 con inclusión intrauterina",
          "Hasta USD. 110.000 con inclusión intrauterina",
          "Hasta USD. 50.000 con inclusión intrauterina",
          "Hasta USD. 70.000 con inclusión intrauterina",
          "Hasta USD. 150.000 con inclusión intrauterina",
          "Incluido en complicaciones de maternidad",
          "Incluido en complicaciones de maternidad",
          "Incluido en complicaciones de maternidad",
          "Hasta USD 15.000 con inclusion intrauterina",
          "Hasta USD 30.000 con inclusion intrauterina",
          "USD 10.000 con inclusión intrauterina",
          "USD 15.000 con inclusión intrauterina en hospital de la Red",
          "USD 30.000 con inclusión intrauterina en hospital de la Red"
        ]
      },
      {
        "label": "Cobertura por enfermedad o accidentes en viajes al exterior",
        "values": [
          "USD 50.000",
          "USD 50.000",
          "USD 50.000",
          "USD 100.000",
          "USD 100.000",
          "USD 40.000",
          "USD 40.000",
          "USD 40.000",
          "USD 30.000",
          "USD 30.000",
          "USD 60.000",
          "No Incluye",
          "No Incluye",
          "USD 20.000",
          "No Incluye",
          "No Incluye",
          "USD 40.000",
          "No Incluye",
          "No Incluye"
        ]
      },
      {
        "label": "Maximo dias por viaje",
        "values": [
          "30 Días Por Viaje",
          "30 Días Por Viaje",
          "30 Días Por Viaje",
          "15 Días Por Año",
          "30 Días Por Año",
          "30 Días Por Viaje",
          "30 Días Por Viaje",
          "30 Días Por Viaje",
          "30 Días Por Viaje",
          "30 Días Por Viaje",
          "60 Días por viaje",
          "No posee",
          "No posee",
          "No posee",
          "No Incluye",
          "No Incluye",
          "30 Días Por Viaje",
          "No Incluye",
          "No Incluye"
        ]
      },
      {
        "label": "Seguro de Vida",
        "values": [
          "USD 10.000 por accidente",
          "USD 10.000 por accidente",
          "USD 10.000 por accidente",
          "USD 5.000 hasta 65 años",
          "USD 5.000 hasta 65 años",
          "No Incluye",
          "No Incluye",
          "No Incluye",
          "No Incluye",
          "No Incluye",
          "No Incluye",
          "No Incluye",
          "No Incluye",
          "No Incluye",
          "USD 5.000 hasta 65 años",
          "USD 5.000 hasta 65 años",
          "No Incluye",
          "No Incluye",
          "No Incluye"
        ]
      },
      {
        "label": "Incapacidad total y permanente",
        "values": [
          "USD 10.000 por accidente",
          "USD 10.000 por accidente",
          "USD 10.000 por accidente",
          "No Incluye",
          "No Incluye",
          "No Incluye",
          "No Incluye",
          "No Incluye",
          "No Incluye",
          "No Incluye",
          "No Incluye",
          "No Incluye",
          "No Incluye",
          "No Incluye",
          "No Incluye",
          "No Incluye",
          "No Incluye",
          "No Incluye",
          "No Incluye"
        ]
      },
      {
        "label": "Plan Exequial",
        "values": [
          "Incluido",
          "Incluido",
          "Incluido",
          "Incluido",
          "Incluido",
          "Incluido",
          "Incluido",
          "Incluido",
          "Incluido",
          "Incluido",
          "Incluido",
          "Incluido",
          "Incluido",
          "Incluido",
          "Incluido",
          "Incluido",
          "Incluido",
          "Incluido",
          "Incluido"
        ]
      },
      {
        "label": "Plan Dental",
        "values": [
          "Incluido",
          "Incluido",
          "Incluido",
          "No Incluye",
          "No Incluye",
          "Bono de usd 200",
          "Bono de USD 200",
          "Bono de USD 200",
          "Plan Básico",
          "Plan Básico",
          "Plan Básico",
          "No Incluye",
          "No Incluye",
          "No Incluye",
          "No Incluye",
          "No Incluye",
          "Bono de USD 200",
          "Plan Básico",
          "Plan Básico"
        ]
      },
      {
        "label": "Saludsa Vitality",
        "values": [
          "No posee",
          "No posee",
          "No posee",
          "No posee",
          "No posee",
          "No posee",
          "No posee",
          "No posee",
          "Hasta 20% de descuento anual en la tarifa del plan médico con el programa",
          "Hasta 20% de descuento anual en la tarifa del plan medico con el programa",
          "Hasta 20% de descuento anual en la tarifa del plan medico con el programa",
          "No posee",
          "No posee",
          "No posee",
          "No Incluye",
          "No Incluye",
          "No Incluye",
          "Hasta 20% de descuento anual en la tarifa del plan medico con el programa",
          "Hasta 20% de descuento anual en la tarifa del plan medico con el programa"
        ]
      },
      {
        "label": "Cobertura Condiciones Medicas Preexistentes",
        "values": [
          "Hasta 20 salarios básicos unificados USD 9.600 por año para todos los diagnósticos con carencia de 24 meses",
          "Hasta 20 salarios básicos unificados USD 9.600 por año para todos los diagnósticos con carencia de 24 meses",
          "Hasta 20 salarios básicos unificados USD 9.600 por año para todos los diagnósticos con carencia de 24 meses",
          "Desde el mes 7 USD 540  - mes 12 USD 1.350 y mes 25 hasta 20 salarios basicos unificados USD 9.600.",
          "Desde el mes 7 USD 540  - mes 12 USD 1.350 y mes 25 hasta 20 salarios básicos unificados USD 9.600.",
          "Desde el mes 13 USD. 600 y mes 25 hasta 20 salarios basicos unificados USD 9.600.",
          "Desde el mes 13 USD 800 y mes 25 hasta 20 salarios básicos unificados USD 9.600.",
          "Desde el mes 13 USD. 1.000 y mes 25 hasta 20 salarios básicos unificados USD 9.600.",
          "Desde el mes 13 USD 700 y mes 25 hasta 20 salarios básicos unificados USD 9.600.",
          "Desde el mes 13 USD 700 y mes 25 hasta 20 salarios básicos unificados USD 9.600.",
          "Desde el mes 13 USD 800 y mes 25 hasta 20 salarios básicos unificados USD 9.600.",
          "Desde el mes 13 USD 500 y mes 25 hasta 20 salarios básicos unificados USD 9.600.",
          "Desde el mes 13 USD 1.000 y mes 25 hasta 20 salarios básicos unificados USD 9.600.",
          "Desde el mes 13 USD 1.500 y mes 25 hasta 20 salarios básicos unificados USD 9.600.",
          "Desde el mes 13 USD 1.350 y mes 25 hasta 20 salarios básicos unificados USD 9.600.",
          "Desde el mes 13 USD 1.350 y mes 25 hasta 20 salarios básicos unificados USD 9.600.",
          "Desde el mes 13 USD 500 y mes 25 hasta 20 salarios básicos unificados USD 9.600.",
          "Desde el mes 13 USD 400 y mes 25 hasta 20 salarios básicos unificados USD 9.600.",
          "Desde el mes 13 USD 600 y mes 25 hasta 20 salarios básicos unificados USD 9.600."
        ]
      }
    ]
  },
  "internacional": {
    "plans": [
      {
        "id": "in0",
        "name": "BMI IDEAL",
        "insurer": "BMI"
      },
      {
        "id": "in1",
        "name": "SALUD EXPERIENCE",
        "insurer": "Saludsa"
      },
      {
        "id": "in2",
        "name": "BUPA GLOBAL",
        "insurer": "Bupa"
      }
    ],
    "benefits": [
      {
        "label": "Límite Máximo por Persona al año",
        "values": [
          "2 Millones",
          "2 Millones",
          null
        ]
      },
      {
        "label": "Deducible por persona al año.",
        "values": [
          null,
          null,
          null
        ]
      },
      {
        "label": "Red Medica",
        "values": [
          "Amplia red medica con mas de 5.000 puntos en USA incluye los mejores hospitales como MD Anderson Cancer Center, Mayo Clinic, Cleveland Clinic entre otros y Libre elección de médicos y hospitales en el resto del mundo.",
          "Red Medica en USA y en el resto del mundo.",
          "Red Medica en USA Blue Cross Blue Shield en USA  y libre eleccionn en el resto del mundo."
        ]
      },
      {
        "label": "Cobertura Hospitalaria",
        "values": [
          "100%",
          "100%",
          "100%"
        ]
      },
      {
        "label": "Quimioterapia y Radioterapia",
        "values": [
          "Ilimitadas",
          "Hasta 180 sesiones por año",
          "Ilimitadas"
        ]
      },
      {
        "label": "Transplante de organos",
        "values": [
          "1 Millon",
          "USD 250.000",
          "2Millones en Ecuador y USD 500.000 fuera"
        ]
      },
      {
        "label": "Tratamientos de la funcion renal Dialisis",
        "values": [
          "100%",
          "Solo hasta 45 dias",
          "100%"
        ]
      },
      {
        "label": "Terapias Fisicas y respiratorias",
        "values": [
          "Ilimitadas",
          "Solo hasta 30 dias por año",
          "Tope del Plan"
        ]
      },
      {
        "label": "Cobertura Ambulatoria",
        "values": [
          "100%",
          "80%",
          "100%"
        ]
      },
      {
        "label": "Cobertura para medicamentos",
        "values": [
          "100%",
          "80%",
          "100%"
        ]
      },
      {
        "label": "Ambulancia Aerea",
        "values": [
          "USD 35.000",
          "USD 25.000",
          "USD 35.000"
        ]
      },
      {
        "label": "Asistencia en Viajes",
        "values": [
          "Cobertura al 100% sin deducible.",
          "Cobertura hasta 100.000 sin deducible",
          "Incluida"
        ]
      },
      {
        "label": "Cobertura de Preexistencias",
        "values": [
          "Hasta 20 Salarios Basicos Unificados a partir del mes 25",
          "Hasta 20 Salarios Basicos Unificados a partir del mes 25",
          "Hasta 20 Salarios Basicos Unificados a partir del mes 25"
        ]
      },
      {
        "label": "Consulta Homeopaticas",
        "values": [
          "Sin límite",
          "hasta 12 consultas al año",
          "Sin limite"
        ]
      },
      {
        "label": "Monto Total de Cobertura",
        "values": [
          "2 Millones",
          null,
          "2 Millones"
        ]
      },
      {
        "label": "Deducible por persona annual (maximo 2 deducibles por persona)",
        "values": [
          "USD 10.000",
          null,
          "USD 10.000"
        ]
      }
    ]
  },
  "vehiculos": {
    "plans": [
      {
        "id": "ve0",
        "name": "Seguros Atlantida",
        "insurer": "Atlántida"
      },
      {
        "id": "ve1",
        "name": "Zurich",
        "insurer": "Zurich"
      },
      {
        "id": "ve2",
        "name": "Sweaden (Cross Plus)",
        "insurer": "Sweaden"
      },
      {
        "id": "ve3",
        "name": "AIG",
        "insurer": "AIG"
      }
    ],
    "benefits": [
      {
        "label": "Todo Riesgo",
        "values": [
          "SI",
          "SI",
          "SI",
          "SI"
        ]
      },
      {
        "label": "Responsabilidad Civil",
        "values": [
          "USD 45.000",
          "USD 50.000",
          "USD 50.000",
          "USD 40.000"
        ]
      },
      {
        "label": "Amparo Patrimonial",
        "values": [
          "SI",
          "SI",
          "SI",
          "SI"
        ]
      },
      {
        "label": "Gastos Medicos por Accidente",
        "values": [
          "USD 3.000 por ocupante",
          "USD 4.000 por ocupante",
          "USD 2.500 por ocupante",
          "USD 3.000 por ocupante"
        ]
      },
      {
        "label": "Muerte Accidental",
        "values": [
          "USD 5.000 por ocupante",
          "USD 15.000 Titular y USD 10.000 por ocupante",
          "USD 6.000 por ocupante",
          "USD 10.000 al conductor"
        ]
      },
      {
        "label": "Asistencias",
        "values": [
          "Programa completo",
          "Programa completo",
          "Programa completo",
          "Programa completo"
        ]
      },
      {
        "label": "Servicio de Grúa",
        "values": [
          "Hasta 300 km",
          "Hasta USD 300",
          "Hasta 300 km",
          "Hasta USD 300"
        ]
      },
      {
        "label": "Auto por Auto",
        "values": [
          "30 días. \nProforma debe superar los USD 1.000 sin IVA.",
          "10 días perdida parcial y 20 días perdida total.\n Proforma debe superar los USD 1.000 sin IVA",
          "30 días. \nProforma debe superar los USD. 1.200 sin IVA",
          "15 días en pérdida parcial y 30 días en pérdida total. \nProforma debe superar los USD 1.400 sin IVA."
        ]
      },
      {
        "label": "Deducible Perdida Parcial",
        "values": [
          "10% del valor del siniestro, 1% del valor asegurado, No menor a USD 300 / 350",
          "10% del valor del siniestro, 1% del valor asegurado, no menor a USD 350",
          "10% del valor del siniestro, 1% del valor asegurado no menor a $250",
          "10% del valor del siniestro, 1% del valor asegurado no menor a USD 300"
        ]
      },
      {
        "label": "Deducible Perdida Total",
        "values": [
          "15% del Valor Asegurado.",
          "15% del Valor Asegurado.",
          "15% del Valor Asegurado",
          "15% del Valor Asegurado"
        ]
      },
      {
        "label": "Deducible Perdida Total por Robo",
        "values": [
          "Con o sin dispositivos. Autos cuya suma asegurada sea hasta USD 30,000: 15% Valor Asegurado / Autos cuya suma asegurada sea mayor a USD. 30,001: 20% Valor Asegurado.",
          "20% del Valor Asegurado",
          "15% del Valor Asegurado",
          "Vehículos de USD 19.999 o menos: 15% del valor asegurado, sin dispositivo. 10% con dispositivo.\nVehículos mayores a USD 20.000: 20% del valor asegurado, sin dispositivo. 10% con dispositivo."
        ]
      },
      {
        "label": "Formas de Pago",
        "values": [
          "Tarjeta de Crédito: diferido hasta 12 meses sin interes.\n Débito Bancario: Hasta 10 cuotas no menores de USD 50",
          "Tarjeta de Crédito: diferido hasta 12 meses sin interes.\n Débito Bancario: Hasta 10 cuotas no menores de USD 50",
          "Tarjeta de Crédito: diferido hasta 12 meses sin interes cuotas no menores de UDS 50\n Débito Bancario: Hasta 8 cuotas no menores de USD 50",
          "Tarjeta de Crédito: diferido hasta 12 meses sin interes.\n Débito Bancario: Hasta 10 cuotas no menores de USD 50"
        ]
      }
    ]
  }
}
