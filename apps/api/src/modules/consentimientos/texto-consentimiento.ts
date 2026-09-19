/**
 * Texto del consentimiento que lee y acepta el cliente.
 *
 * La VERSION importa tanto como el texto: cuando esto cambie, hay que subir el
 * número. Los consentimientos ya otorgados guardan la versión y la huella del
 * texto que el cliente leyó, así que siguen probando lo que él aceptó y no lo
 * que dice la política de hoy.
 *
 * REVISAR CON UN ABOGADO antes de usarlo en producción. Esto cubre lo que la
 * LOPDP enumera como información mínima, pero la redacción final y las bases
 * legales invocadas son decisión de quien asesora legalmente a la empresa.
 */

export const VERSION_TEXTO = '1.0'

export const TEXTO_CONSENTIMIENTO = `AUTORIZACIÓN PARA EL TRATAMIENTO DE DATOS PERSONALES

Seguros Ideal Asesores Productores de Seguros Segurosideal Cía. Ltda., que opera
comercialmente como Priority Asesores de Seguros, con domicilio en Av. de los Shyris
N35-174 y Suecia, Edificio Renazzo Plaza, oficina 905, Quito, es el responsable del
tratamiento de tus datos personales.

QUÉ DATOS TRATAMOS
Tus datos de identificación y contacto: nombres, cédula o RUC, fecha de nacimiento,
dirección, teléfono y correo electrónico. También los datos de tus pólizas: plan,
aseguradora, primas, vigencias y beneficiarios.

Tratamos además DATOS DE SALUD —preexistencias declaradas y la información médica
necesaria para gestionar tus reembolsos y reclamos—. La ley los considera datos
sensibles y por eso te los señalamos por separado.

PARA QUÉ LOS USAMOS
· Gestionar tu contratación, renovación y cancelación de pólizas.
· Tramitar tus reembolsos, reclamos y requerimientos ante las aseguradoras.
· Contactarte sobre tus pólizas, vencimientos y gestiones en curso.
· Cumplir las obligaciones que nos exigen la Superintendencia de Compañías y el
  Servicio de Rentas Internas.

CON QUIÉN LOS COMPARTIMOS
Con las aseguradoras con las que contratas o cotizas, porque sin eso no podemos
gestionar tu póliza. Con las autoridades que nos los requieran por ley.
No vendemos tus datos ni los cedemos con fines publicitarios a terceros.

POR CUÁNTO TIEMPO
Mientras seas nuestro cliente y, después, durante los plazos que exige la normativa
de seguros y tributaria para conservar respaldos de las operaciones.

TUS DERECHOS
Puedes pedirnos en cualquier momento acceder a tus datos, rectificarlos, eliminarlos,
oponerte a su tratamiento, pedir que se limite o solicitar una copia portable.
Escribe a datos@priority.ec y tenemos 15 días hábiles para responderte.

Puedes RETIRAR ESTA AUTORIZACIÓN cuando quieras, desde el mismo enlace por el que
llegaste aquí o escribiéndonos. Retirarla no afecta a lo que hicimos antes con tu
permiso, pero sí puede impedirnos seguir gestionando tus pólizas.

Si consideras que tratamos mal tus datos, puedes reclamar ante la Superintendencia de
Protección de Datos Personales.

AL ACEPTAR
Declaras que leíste esta información y que autorizas de forma libre, específica e
informada el tratamiento de tus datos personales, incluidos los de salud, para los
fines descritos arriba.`
