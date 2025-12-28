
import React from 'react';
import { Language } from '../types';

interface TermsContentProps {
  language: Language;
}

const TermsContent: React.FC<TermsContentProps> = ({ language = 'pt' }) => {
  if (language === 'en') {
    return (
      <div className="text-gray-300 text-xs leading-relaxed space-y-4 font-sans text-justify">
        <h3 className="text-[#dd9933] font-bold text-lg mb-2 text-center">Welcome to ©Central Crypto Traders!</h3>
        <p>Before using our platform, it is important that you carefully read and agree to these Terms of Use. By accessing or using our site, you indicate that you have read, understood, and agreed to all the terms and conditions set forth herein. If you do not agree with these terms, please do not use our site.</p>
        <div>
          <h4 className="text-gray-200 font-bold mb-1">Platform Usage</h4>
          <p className="mb-2"><strong>1.1.</strong> By using our site, you agree to comply with all applicable laws and accept responsibility for your conduct while using our services.</p>
          <p className="mb-2"><strong>1.2.</strong> You are responsible for providing accurate and up-to-date information when registering on our platform. Additionally, it is your responsibility to maintain the confidentiality of your access credentials, such as username and password.</p>
          <p className="mb-2"><strong>1.3.</strong> Our platform allows the use of a social network, which must be used in accordance with the guidelines and acceptable use policies established by us. You agree not to use the social network for illegal, defamatory, offensive, discriminatory purposes (including, but not limited to, discrimination based on race, color, religion, gender, sexual orientation, nationality, or any other characteristic protected by law), as well as political discussions of any kind.</p>
          <p className="mb-2 bg-white/5 p-2 rounded border-l-2 border-[#dd9933]">Furthermore, disrespect among community members is strictly prohibited. Any opinion or comment should be expressed only when requested and within acceptable social norms, promoting a respectful and inclusive environment. These guidelines are essential for creating a healthy and collaborative community on our platform. By using our social network, you agree to respect and adhere to these guidelines, promoting an environment of mutual respect among users.</p>
          <p className="mb-2">If you have any questions about these guidelines or encounter any inappropriate behavior within the social network, please contact us immediately and use the available resources to report it. We are committed to ensuring the safety and well-being of all members of our community.</p>
          <p className="mb-2"><strong>1.4.</strong> In addition to the social network, we also provide exclusive indicators and applications for technical analysis of financial charts. These tools are available to assist your studies and analyses, providing momentum data with reliability and precision. However, it is important to note that the data itself is the result of market movements that cannot be predicted, and therefore, the use of these indicators does not guarantee total reliability of results.</p>
          <div className="bg-tech-950/50 p-3 rounded border border-red-500/30 my-3">
            <p className="mb-2 text-gray-200">🚨 <strong>1.4.1.</strong> No indicator, strategy, technical analysis, or opinion issued on the site constitutes financial advice. The information provided is for informational purposes only and should not be considered as recommendations or guarantees of specific financial results. The decision to use these tools and apply the information and analyses is the sole responsibility of the user, and any consequences arising from the decisions made are assumed exclusively by them.</p>
            <p className="text-gray-200">We emphasize that it is fundamental for users to use these tools as an aid in their studies and analyses, complementing them with additional research and seeking professional financial advice, if necessary, before making any investment decisions. 🚨</p>
          </div>
          <div className="bg-green-900/20 p-3 rounded border border-green-500/30 my-3 text-center font-bold text-green-400">✅✅ We remind you that the financial market is highly volatile and subject to risks. Past results do not guarantee future results, and no system or indicator is infallible. It is essential that users understand the risks involved before making any investment. ✅✅</div>
          <p className="mb-2">If you have additional questions about the use of the indicators or any other information on our site, please contact us. We are here to help and provide an informative and transparent environment for our users.</p>
          <p className="mb-2"><strong>1.5.</strong> Our site also offers a technical analysis platform to assist in making investment-related decisions. However, it is important to note that this platform also does not offer financial or investment advice. The information and analyses provided are for informational purposes only and should not be considered investment recommendations.</p>
        </div>
        <div>
          <h4 className="text-gray-200 font-bold mb-1">Payments and Cancellations</h4>
          <p className="mb-2"><strong>2.1.</strong> All subscribers will have a 7-day trial period from the subscription date, during which they can request cancellation of the subscription without any additional charges.</p>
          <p className="mb-2"><strong>2.2.</strong> The subscriber will have the option to cancel the automatic renewal of the subscription at any time through the user panel available in the subscriber's profile. However, cancellation of the subscription will only be allowed after a minimum period of 7 days of permanence. The cancellation must be requested before the scheduled renewal date to avoid future charges.</p>
          <p className="mb-2">We emphasize that it is the subscriber's responsibility to manage their subscription and cancel within the stipulated period if they wish to discontinue the service and avoid additional charges.</p>
          <p className="mb-2">Any questions or difficulties related to cancellation can be clarified by contacting our support team.</p>
          <p className="mb-2"><strong>2.3.</strong> The first charge will be made immediately after payment of the chosen subscription. Cancellation, as specified in point 2.2, will be allowed after the minimum 7-day period of permanence. After 15 days of permanence, Central Crypto Traders reserves the right to charge for the full month. From the second month and at any time, cancellations will be processed according to usage within the billing month and respective accesses will be terminated at the time of the cancellation request.</p>
        </div>
        <div>
          <h4 className="text-gray-200 font-bold mb-1">Intellectual Property</h4>
          <p className="mb-2"><strong>3.1.</strong> All content on our site, including posts made by members of our community, such as texts, graphics, logos, icons, images, audio, video, and software, are the sole responsibility of their respective authors. These posts reflect the personal opinions of each member and do not necessarily represent the official opinion or position of the ©Central Crypto Traders team.</p>
          <p className="mb-2">The ©Central Crypto Traders team assumes no responsibility for the content of members' posts, nor for any errors, inaccuracies, defamations, or copyright violations present in these posts. Each member is fully responsible for what they publish on our platform.</p>
          <p className="mb-2">We reinforce the importance of maintaining a respectful and inclusive environment where opinions can be expressed freely, as long as they are within the limits of the acceptable use guidelines established by us. If you find any inappropriate content or rights violations, please inform us so we can take the necessary measures.</p>
          <p className="mb-2">We are committed to maintaining a collaborative and safe community for all our users. If you have any additional questions or need clarification, do not hesitate to contact us.</p>
          <p className="mb-2"><strong>3.2.</strong> You agree not to copy, reproduce, modify, distribute, display, transmit, or disclose any part of the content without our prior written authorization.</p>
        </div>
        <div>
          <h4 className="text-gray-200 font-bold mb-1">Limitations of Liability</h4>
          <p className="mb-2"><strong>4.1.</strong> Our site is provided "as is" and we make no representations or warranties of any kind, express or implied, regarding its use or the availability of the site, its functionality, reliability, accuracy, or security.</p>
          <p className="mb-2"><strong>4.2.</strong> We are not responsible for any direct, indirect, incidental, consequential, or punitive damages arising from the use or inability to use our site, including, but not limited to, loss of data, profits, or business opportunities.</p>
        </div>
        <div>
          <h4 className="text-gray-200 font-bold mb-1">Modifications to the Terms of Use</h4>
          <p className="mb-2"><strong>5.1.</strong> We reserve the right to modify these Terms of Use at any time without prior notice. We recommend that you regularly review the updated terms. Continued use of the site after any significant changes constitutes your acceptance of these changes.</p>
        </div>
        <div>
          <h4 className="text-gray-200 font-bold mb-1">General Provisions</h4>
          <p className="mb-2"><strong>6.1.</strong> These Terms of Use constitute the entire agreement between you and ©Central Crypto Traders regarding the use of the services provided and supersede all prior or contemporaneous agreements.</p>
          <p className="mb-2"><strong>6.2.</strong> If any provision of these Terms of Use is found to be invalid or unenforceable, the remaining provisions will remain in full force and effect.</p>
          <p className="mb-2"><strong>6.3.</strong> The failure to exercise or enforce any right or provision of these Terms of Use shall not constitute a waiver of such right or provision.</p>
        </div>
        <div className="bg-tech-800 p-4 rounded text-center border border-tech-700 mt-4">
          <p className="font-bold text-[#dd9933] mb-2">✅ By using our site, you acknowledge that you have read and understood these Terms of Use and agree to comply with them in full ✅</p>
          <p className="text-gray-400 text-[10px]">If you have any questions about these terms, please contact us.<br/>Thank you for using our platform.</p>
        </div>
      </div>
    );
  }

  if (language === 'es') {
    return (
      <div className="text-gray-300 text-xs leading-relaxed space-y-4 font-sans text-justify">
        <h3 className="text-[#dd9933] font-bold text-lg mb-2 text-center">¡Bienvenido a ©Central Crypto Traders!</h3>
        <p>Antes de utilizar nuestra plataforma, es importante que lea atentamente y acepte estos Términos de Uso. Al acceder o utilizar nuestro sitio, usted indica que ha leído, entendido y aceptado todos los términos y condiciones aquí establecidos. Si no está de acuerdo con estos términos, por favor, no utilice nuestro sitio.</p>
        <div>
          <h4 className="text-gray-200 font-bold mb-1">Uso de la Plataforma</h4>
          <p className="mb-2"><strong>1.1.</strong> Al utilizar nuestro sitio, usted se compromete a cumplir con todas las leyes aplicables y acepta la responsabilidad por su conducta durante el uso de nuestros servicios.</p>
          <p className="mb-2"><strong>1.2.</strong> Usted es responsable de proporcionar información precisa y actualizada al registrarse en nuestra plataforma. Además, es su responsabilidad mantener la confidencialidad de sus credenciales de acceso, como el nombre de usuario y la contraseña.</p>
          <p className="mb-2"><strong>1.3.</strong> Nuestra plataforma permite el uso de una red social, que debe utilizarse de acuerdo con las directrices y políticas de uso aceptable establecidas por nosotros. Usted se compromete a no utilizar la red social para fines ilegales, difamatorios, ofensivos, discriminatorios (incluyendo, entre otros, la discriminación por motivos de raza, color, religión, género, orientación sexual, nacionalidad o cualquier otra característica protegida por la ley), así como discusiones políticas de cualquier tipo.</p>
          <p className="mb-2 bg-white/5 p-2 rounded border-l-2 border-[#dd9933]">Además, está estrictamente prohibido el irrespeto entre los miembros de la comunidad. Cualquier opinión o comentario debe expresarse solo cuando se solicite y dentro de las normas aceptables de convivencia social, promoviendo un ambiente respetuoso e inclusivo. Estas directrices son esenciales para crear una comunidad sana y colaborativa en nuestra plataforma. Al utilizar nuestra red social, usted se compromete a respetar y cumplir estas directrices, promoviendo un ambiente de respeto mutuo entre los usuarios.</p>
          <p className="mb-2">Si tiene alguna pregunta sobre estas directrices o si encuentra algún comportamiento inapropiado dentro de la red social, le pedimos que se ponga en contacto con nosotros de inmediato y utilice los recursos disponibles para realizar su denuncia. Estamos comprometidos a garantizar la seguridad y el bienestar de todos los miembros de nuestra comunidad.</p>
          <p className="mb-2"><strong>1.4.</strong> Además de la red social, también proporcionamos indicadores y aplicaciones exclusivas para el análisis técnico de gráficos financieros. Estas herramientas están disponibles para ayudar en sus estudios y análisis, proporcionando datos de momento con fiabilidad y precisión. Sin embargo, es importante destacar que los datos en sí son el resultado de movimientos del mercado que no se pueden predecir y, por lo tanto, el uso de estos indicadores no garantiza la total fiabilidad de los resultados.</p>
          <div className="bg-tech-950/50 p-3 rounded border border-red-500/30 my-3">
            <p className="mb-2 text-gray-200">🚨 <strong>1.4.1.</strong> Ningún indicador, estrategia, análisis técnico u opinión emitida en el sitio constituye asesoramiento financiero. La información proporcionada tiene un carácter meramente informativo y no debe considerarse como recomendaciones o garantías de resultados financieros específicos. La decisión de utilizar estas herramientas y aplicar la información y los análisis es responsabilidad total del usuario, y cualquier consecuencia derivada de las decisiones tomadas es asumida exclusivamente por él.</p>
            <p className="text-gray-200">Reiteramos que es fundamental que los usuarios utilicen estas herramientas como ayuda en sus estudios y análisis, complementándolas con investigaciones adicionales y buscando asesoramiento financiero profesional, si es necesario, antes de tomar cualquier decisión de inversión. 🚨</p>
          </div>
          <div className="bg-green-900/20 p-3 rounded border border-green-500/30 my-3 text-center font-bold text-green-400">✅✅ Le recordamos que el mercado financiero es altamente volátil y está sujeto a riesgos. Los resultados pasados no garantizan resultados futuros, y ningún sistema o indicador es infalible. Es esencial que los usuarios comprendan los riesgos involucrados antes de realizar cualquier inversión. ✅✅</div>
          <p className="mb-2">Si tiene preguntas adicionales sobre el uso de los indicadores o cualquier otra información presente en nuestro sitio, póngase en contacto con nosotros. Estamos aquí para ayudar y proporcionar un entorno informativo y transparente para nuestros usuarios.</p>
          <p className="mb-2"><strong>1.5.</strong> Nuestro sitio también ofrece una plataforma de análisis técnico para ayudar en la toma de decisiones relacionadas con las inversiones. Sin embargo, es importante destacar que esta plataforma tampoco ofrece asesoramiento financiero o de inversión. La información y los análisis proporcionados son solo para fines informativos y no deben considerarse como recomendaciones de inversión.</p>
        </div>
        <div>
          <h4 className="text-gray-200 font-bold mb-1">Pagos y Cancelaciones</h4>
          <p className="mb-2"><strong>2.1.</strong> Todos los suscriptores tendrán un período de prueba de 7 días corridos a partir de la fecha de suscripción, durante el cual podrán solicitar la cancelación de la suscripción sin cargos adicionales.</p>
          <p className="mb-2"><strong>2.2.</strong> El suscriptor tendrá la facultad de cancelar la renovación automática de la suscripción en cualquier momento, a través del panel de usuario disponible en el perfil del suscriptor. Sin embargo, la cancelación de la suscripción solo se permitirá después de un período mínimo de 7 días de permanencia. La cancelación deberá solicitarse antes de la fecha de renovación prevista para evitar cargos futuros.</p>
          <p className="mb-2">Reiteramos que es responsabilidad del suscriptor gestionar su suscripción y efectuar la cancelación dentro del plazo estipulado si desea interrumpir el servicio y evitar cargos adicionales.</p>
          <p className="mb-2">Cualquier duda o dificultad relacionada con la cancelación puede aclararse contactando a nuestro equipo de soporte.</p>
          <p className="mb-2"><strong>2.3.</strong> El primer cargo se efectuará inmediatamente después del pago de la suscripción elegida. La cancelación, según lo especificado en el punto 2.2, se permitirá después de los 7 días de permanencia mínima. Después de 15 días de permanencia, Central Crypto Traders se reserva el derecho de cobrar el mes completo. A partir del segundo mes y en cualquier momento, las cancelaciones se procesarán de acuerdo con el uso dentro del mes de facturación y los accesos respectivos se extinguirán en el momento de la solicitud de cancelación.</p>
        </div>
        <div>
          <h4 className="text-gray-200 font-bold mb-1">Propiedad Intelectual</h4>
          <p className="mb-2"><strong>3.1.</strong> Todo el contenido presente en nuestro sitio, incluidas las publicaciones realizadas por los miembros de nuestra comunidad, como textos, gráficos, logotipos, iconos, imágenes, audio, video y software, son responsabilidad exclusiva de sus respectivos autores. Estas publicaciones reflejan las opiniones personales de cada miembro y no representan necesariamente la opinión o posición oficial del equipo de ©Central Crypto Traders.</p>
          <p className="mb-2">El equipo de ©Central Crypto Traders no asume ninguna responsabilidad por el contenido de las publicaciones de los miembros, así como por cualquier error, inexactitud, difamación o violación de los derechos de autor presentes en dichas publicaciones. Cada miembro es totalmente responsable de lo que publica en nuestra plataforma.</p>
          <p className="mb-2">Reiteramos la importancia de mantener un ambiente respetuoso e inclusivo, donde las opiniones puedan expresarse libremente, siempre que se encuentren dentro de los límites de las directrices de uso aceptable establecidas por nosotros. Si encuentra algún contenido inapropiado o violación de derechos, le pedimos que nos informe para que podamos tomar las medidas necesarias.</p>
          <p className="mb-2">Estamos comprometidos a mantener una comunidad colaborativa y segura para todos nuestros usuarios. Si tiene alguna pregunta adicional o necesita aclaraciones, no dude en ponerse en contacto con nosotros.</p>
          <p className="mb-2"><strong>3.2.</strong> Usted se compromete a no copiar, reproducir, modificar, distribuir, exhibir, transmitir o divulgar ninguna parte del contenido sin nuestra autorización previa por escrito.</p>
        </div>
        <div>
          <h4 className="text-gray-200 font-bold mb-1">Limitaciones de Responsabilidad</h4>
          <p className="mb-2"><strong>4.1.</strong> Nuestro sitio se proporciona "tal cual" y no hacemos representaciones ni garantías de ningún tipo, expresas o implícitas, con respecto a su uso o la disponibilidad del sitio, su funcionalidad, fiabilidad, precisión o seguridad.</p>
          <p className="mb-2"><strong>4.2.</strong> No nos hacemos responsables de ninguna pérdida o daño directo, indirecto, incidental, consecuente o punitivo que surja del uso o la incapacidad de usar nuestro sitio, incluyendo, entre otros, la pérdida de datos, ganancias u oportunidades de negocio.</p>
        </div>
        <div>
          <h4 className="text-gray-200 font-bold mb-1">Modificaciones de los Términos de Uso</h4>
          <p className="mb-2"><strong>5.1.</strong> Nos reservamos el derecho de modificar estos Términos de Uso en cualquier momento y sin previo aviso. Le recomendamos que revise regularmente los términos actualizados. El uso continuado del sitio después de cualquier cambio significativo constituye su aceptación de dichos cambios.</p>
        </div>
        <div>
          <h4 className="text-gray-200 font-bold mb-1">Disposiciones Generales</h4>
          <p className="mb-2"><strong>6.1.</strong> Estos Términos de Uso constituyen el acuerdo completo entre usted y ©Central Crypto Traders con respecto al uso de los servicios proporcionados y reemplazan todos los acuerdos anteriores o contemporáneos.</p>
          <p className="mb-2"><strong>6.2.</strong> Si alguna disposición de estos Términos de Uso se considera inválida o inaplicable, las demás disposiciones permanecerán en pleno vigor y efecto.</p>
          <p className="mb-2"><strong>6.3.</strong> El hecho de no ejercer o hacer cumplir cualquier derecho o disposición de estos Términos de Uso no constituirá una renuncia a dicho derecho o disposición.</p>
        </div>
        <div className="bg-tech-800 p-4 rounded text-center border border-tech-700 mt-4">
          <p className="font-bold text-[#dd9933] mb-2">✅ Al utilizar nuestro sitio, usted reconoce que ha leído y entendido estos Términos de Uso y se compromete a cumplirlos en su totalidad ✅</p>
          <p className="text-gray-400 text-[10px]">Si tiene alguna pregunta sobre estos términos, póngase en contacto con nosotros.<br/>Gracias por utilizar nuestra plataforma.</p>
        </div>
      </div>
    );
  }

  // PT
  return (
    <div className="text-gray-300 text-xs leading-relaxed space-y-4 font-sans text-justify">
      <h3 className="text-[#dd9933] font-bold text-lg mb-2 text-center">Bem-vindo ao ©Central Crypto Traders!</h3>
      
      <p>
        Antes de utilizar nossa plataforma, é importante que você leia atentamente e concorde com estes Termos de Uso. Ao acessar ou utilizar nosso site, você indica que leu, compreendeu e concordou com todos os termos e condições estabelecidos aqui. Se você não concorda com estes termos, por favor, não utilize nosso site.
      </p>

      <div>
        <h4 className="text-gray-200 font-bold mb-1">Uso da Plataforma</h4>
        <p className="mb-2"><strong>1.1.</strong> Ao utilizar nosso site, você concorda em cumprir todas as leis aplicáveis e aceita a responsabilidade pela sua conduta durante o uso dos nossos serviços.</p>
        <p className="mb-2"><strong>1.2.</strong> Você é responsável por fornecer informações precisas e atualizadas ao se cadastrar em nossa plataforma. Além disso, é de sua responsabilidade manter a confidencialidade de suas credenciais de acesso, como nome de usuário e senha.</p>
        <p className="mb-2"><strong>1.3.</strong> Nossa plataforma permite o uso de uma rede social, que deve ser utilizada de acordo com as diretrizes e políticas de uso aceitável estabelecidas por nós. Você concorda em não utilizar a rede social para fins ilegais, difamatórios, ofensivos, discriminatórios (incluindo, mas não se limitando a, discriminação com base em raça, cor, religião, gênero, orientação sexual, nacionalidade, ou qualquer outra característica protegida por lei), bem como discussões políticas de qualquer espécie.</p>
        <p className="mb-2 bg-white/5 p-2 rounded border-l-2 border-[#dd9933]">
          Além disso, é estritamente proibido o desrespeito entre membros da comunidade. Qualquer opinião ou comentário deve ser expresso apenas quando solicitado e dentro das normas aceitáveis de convívio social, promovendo um ambiente respeitoso e inclusivo. Essas diretrizes são essenciais para criar uma comunidade saudável e colaborativa em nossa plataforma. Ao utilizar nossa rede social, você concorda em respeitar e aderir a essas diretrizes, promovendo um ambiente de respeito mútuo entre os usuários.
        </p>
        <p className="mb-2">Se você tiver alguma dúvida sobre essas diretrizes ou se encontrar algum comportamento inadequado dentro da rede social, pedimos que entre em contato conosco imediatamente e utilize os recursos disponíveis para realizar sua denúncia. Estamos comprometidos em garantir a segurança e o bem-estar de todos os membros de nossa comunidade.</p>
        <p className="mb-2"><strong>1.4.</strong> Além da rede social, também fornecemos indicadores exclusivos e aplicativos para análise técnica de gráficos financeiros. Essas ferramentas são disponibilizadas para auxiliar seus estudos e análises, fornecendo dados de momento com confiabilidade e precisão. No entanto, é importante ressaltar que os dados em si são resultados de movimentos de mercado que não podem ser previstos, e por isso, a utilização desses indicadores não garante total confiabilidade de resultados.</p>
        
        <div className="bg-tech-950/50 p-3 rounded border border-red-500/30 my-3">
            <p className="mb-2 text-gray-200">
              🚨 <strong>1.4.1.</strong> Nenhum indicador, estratégia, análise técnica ou opinião emitida no site constitui aconselhamento financeiro. As informações fornecidas têm caráter meramente informativo e não devem ser consideradas como recomendações ou garantias de resultados financeiros específicos. A decisão de utilizar essas ferramentas e aplicar as informações e análises é de total responsabilidade do usuário, e quaisquer consequências decorrentes das decisões tomadas são assumidas exclusivamente por ele.
            </p>
            <p className="text-gray-200">
              Reforçamos que é fundamental que os usuários utilizem essas ferramentas como auxílio em seus estudos e análises, complementando-as com pesquisas adicionais e buscando aconselhamento financeiro profissional, caso necessário, antes de tomar quaisquer decisões de investimento. 🚨
            </p>
        </div>

        <div className="bg-green-900/20 p-3 rounded border border-green-500/30 my-3 text-center font-bold text-green-400">
           ✅✅ Lembramos que o mercado financeiro é altamente volátil e sujeito a riscos. Os resultados passados não garantem resultados futuros, e nenhum sistema ou indicador é infalível. É essencial que os usuários compreendam os riscos envolvidos antes de realizar qualquer investimento. ✅✅
        </div>

        <p className="mb-2">Se você tiver dúvidas adicionais sobre o uso dos indicadores ou qualquer outra informação presente em nosso site, entre em contato conosco. Estamos aqui para ajudar e fornecer um ambiente informativo e transparente para nossos usuários.</p>
        <p className="mb-2"><strong>1.5.</strong> Nosso site também oferece uma plataforma de análise técnica para auxiliar na tomada de decisões relacionadas a investimentos. No entanto, é importante ressaltar que essa plataforma também não oferece aconselhamento financeiro ou de investimento. As informações e análises fornecidas são apenas para fins informativos e não devem ser consideradas como recomendações de investimento.</p>
      </div>

      <div>
        <h4 className="text-gray-200 font-bold mb-1">Pagamentos e cancelamentos</h4>
        <p className="mb-2"><strong>2.1.</strong> Todos os assinantes terão um período de testes de 7 dias corridos a partir da data de assinatura, durante o qual poderão solicitar o cancelamento da assinatura sem quaisquer cobranças adicionais.</p>
        <p className="mb-2"><strong>2.2.</strong> O assinante terá a faculdade de cancelar a renovação automática da assinatura em qualquer momento, através do painel de usuário disponível no perfil do assinante. No entanto, o cancelamento da assinatura só será permitido após um período mínimo de 7 dias de permanência. O cancelamento deverá ser solicitado antes da data de renovação prevista para evitar cobranças futuras.</p>
        <p className="mb-2">Reforçamos que é responsabilidade do assinante gerenciar sua assinatura e efetuar o cancelamento dentro do prazo estipulado caso deseje interromper o serviço e evitar cobranças adicionais.</p>
        <p className="mb-2">Quaisquer dúvidas ou dificuldades relacionadas ao cancelamento podem ser esclarecidas entrando em contato com nossa equipe de suporte.</p>
        <p className="mb-2"><strong>2.3.</strong> A primeira cobrança será efetuada imediatamente após o pagamento da assinatura escolhida. O cancelamento, conforme especificado no ponto 2.2, será permitido após os 7 dias de permanência mínima. Após 15 dias de permanência, a Central Crypto Traders se reserva o direito de cobrar o mês completo. A partir do segundo mês e a qualquer momento, os cancelamentos serão processados de acordo com o uso dentro do mês de faturamento e os acessos respectivos serão extinguidos no momento da solicitação do cancelamento.</p>
      </div>

      <div>
        <h4 className="text-gray-200 font-bold mb-1">Propriedade Intelectual</h4>
        <p className="mb-2"><strong>3.1.</strong> Todo o conteúdo presente em nosso site, incluindo postagens realizadas pelos membros da nossa comunidade, como textos, gráficos, logotipos, ícones, imagens, áudio, vídeo e software, são de responsabilidade exclusiva dos respectivos autores. Essas postagens refletem as opiniões pessoais de cada membro e não representam necessariamente a opinião ou posição oficial da equipe ©Central Crypto Traders.</p>
        <p className="mb-2">A equipe ©Central Crypto Traders não assume qualquer responsabilidade pelo conteúdo das postagens dos membros, bem como por quaisquer erros, imprecisões, difamações ou violações de direitos autorais presentes nessas postagens. Cada membro é inteiramente responsável pelo que publica em nossa plataforma.</p>
        <p className="mb-2">Reforçamos a importância de manter um ambiente respeitoso e inclusivo, onde as opiniões possam ser expressas livremente, desde que dentro dos limites das diretrizes de uso aceitável estabelecidas por nós. Caso você encontre algum conteúdo inadequado ou violação de direitos, pedimos que nos informe para que possamos tomar as medidas necessárias.</p>
        <p className="mb-2">Estamos empenhados em manter uma comunidade colaborativa e segura para todos os nossos usuários. Se tiver alguma dúvida adicional ou precisar de esclarecimentos, não hesite em entrar em contato conosco.</p>
        <p className="mb-2"><strong>3.2.</strong> Você concorda em não copiar, reproduzir, modificar, distribuir, exibir, transmitir ou divulgar qualquer parte do conteúdo sem nossa autorização prévia por escrito.</p>
      </div>

      <div>
        <h4 className="text-gray-200 font-bold mb-1">Limitações de Responsabilidade</h4>
        <p className="mb-2"><strong>4.1.</strong> Nosso site é fornecido "no estado em que se encontra" e não fazemos representações ou garantias de qualquer tipo, expressas ou implícitas, em relação ao seu uso ou à disponibilidade do site, sua funcionalidade, confiabilidade, precisão ou segurança.</p>
        <p className="mb-2"><strong>4.2.</strong> Não nos responsabilizamos por quaisquer perdas ou danos diretos, indiretos, incidentais, consequenciais ou punitivos decorrentes do uso ou incapacidade de uso do nosso site, incluindo, mas não se limitando a perdas de dados, lucros ou oportunidades de negócios.</p>
      </div>

      <div>
        <h4 className="text-gray-200 font-bold mb-1">Modificações nos Termos de Uso</h4>
        <p className="mb-2"><strong>5.1.</strong> Reservamo-nos o direito de modificar estes Termos de Uso a qualquer momento, sem aviso prévio. Recomendamos que você revise regularmente os termos atualizados. O uso contínuo do site após quaisquer alterações significativas constitui sua aceitação dessas alterações.</p>
      </div>

      <div>
        <h4 className="text-gray-200 font-bold mb-1">Disposições Gerais</h4>
        <p className="mb-2"><strong>6.1.</strong> Estes Termos de Uso constituem o acordo integral entre você e a ©Central Crypto Traders em relação ao uso dos serviços disponibilizados e substituem todos os acordos anteriores ou contemporâneos.</p>
        <p className="mb-2"><strong>6.2.</strong> Se qualquer disposição destes Termos de Uso for considerada inválida ou inexequível, as demais disposições permanecerão em pleno vigor e efeito.</p>
        <p className="mb-2"><strong>6.3.</strong> A falha em exercer ou fazer cumprir qualquer direito ou disposição destes Termos de Uso não constituirá renúncia a tal direito ou disposição.</p>
      </div>

      <div className="bg-tech-800 p-4 rounded text-center border border-tech-700 mt-4">
         <p className="font-bold text-[#dd9933] mb-2">✅ Ao utilizar nosso site, você reconhece que leu e entendeu estes Termos de Uso e concorda em cumpri-los integralmente ✅</p>
         <p className="text-gray-400 text-[10px]">Se tiver alguma dúvida sobre estes termos, entre em contato conosco.<br/>Obrigado por utilizar nossa plataforma.</p>
      </div>
    </div>
  );
};

export default TermsContent;
