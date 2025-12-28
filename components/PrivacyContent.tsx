
import React from 'react';
import { Language } from '../types';

interface PrivacyContentProps {
  language: Language;
}

const PrivacyContent: React.FC<PrivacyContentProps> = ({ language = 'pt' }) => {
  if (language === 'en') {
    return (
      <div className="text-gray-300 text-xs leading-relaxed space-y-4 font-sans text-justify">
        <h3 className="text-[#dd9933] font-bold text-lg mb-2 text-center">Privacy Policy</h3>
        <div>
          <h4 className="text-gray-200 font-bold mb-1">Who we are</h4>
          <p className="mb-2">Our platform address is: <span className="text-[#dd9933]">https://centralcrypto.com.br/</span></p>
        </div>
        <div>
          <h4 className="text-gray-200 font-bold mb-1">Comments</h4>
          <p className="mb-2">When visitors leave comments on the site, we collect the data shown in the comments form, and also the visitor’s IP address and browser user agent string to help spam detection.</p>
          <p className="mb-2">An anonymized string created from your email address (also called a hash) may be provided to the Gravatar service to see if you are using it. The Gravatar service privacy policy is available here: https://automattic.com/privacy/. After approval of your comment, your profile picture is visible to the public in the context of your comment.</p>
        </div>
        <div>
          <h4 className="text-gray-200 font-bold mb-1">Media</h4>
          <p className="mb-2">If you upload images to the website, you should avoid uploading images with embedded location data (EXIF GPS) included. Visitors to the website can download and extract any location data from images on the website.</p>
        </div>
        <div>
          <h4 className="text-gray-200 font-bold mb-1">Cookies</h4>
          <p className="mb-2">If you leave a comment on our site you may opt-in to saving your name, email address and website in cookies. These are for your convenience so that you do not have to fill in your details again when you leave another comment. These cookies will last for one year.</p>
          <p className="mb-2">If you visit our login page, we will set a temporary cookie to determine if your browser accepts cookies. This cookie contains no personal data and is discarded when you close your browser.</p>
          <p className="mb-2">When you log in, we will also set up several cookies to save your login information and your screen display choices. Login cookies last for two days, and screen options cookies last for a year. If you select "Remember Me", your login will persist for two weeks. If you log out of your account, the login cookies will be removed.</p>
          <p className="mb-2">If you edit or publish an article, an additional cookie will be saved in your browser. This cookie includes no personal data and simply indicates the post ID of the article you just edited. It expires after 1 day.</p>
        </div>
        <div>
          <h4 className="text-gray-200 font-bold mb-1">Embedded content from other websites</h4>
          <p className="mb-2">Articles on this site may include embedded content (e.g. videos, images, articles, etc.). Embedded content from other websites behaves in the exact same way as if the visitor has visited the other website.</p>
          <p className="mb-2">These websites may collect data about you, use cookies, embed additional third-party tracking, and monitor your interaction with that embedded content, including tracking your interaction with the embedded content if you have an account and are logged in to that website.</p>
        </div>
        <div>
          <h4 className="text-gray-200 font-bold mb-1">Who we share your data with</h4>
          <p className="mb-2">If you request a password reset, your IP address will be included in the reset email.</p>
        </div>
        <div>
          <h4 className="text-gray-200 font-bold mb-1">How long we retain your data</h4>
          <p className="mb-2">If you leave a comment, the comment and its metadata are retained indefinitely. This is so we can recognize and approve any follow-up comments automatically instead of holding them in a moderation queue.</p>
          <p className="mb-2">For users that register on our website, we also store the personal information they provide in their user profile. All users can see, edit, or delete their personal information at any time (except they cannot change their username). Website administrators can also see and edit that information.</p>
        </div>
        <div>
          <h4 className="text-gray-200 font-bold mb-1">What rights you have over your data</h4>
          <p className="mb-2">If you have an account on this site, or have left comments, you can request to receive an exported file of the personal data we hold about you, including any data you have provided to us. You can also request that we erase any personal data we hold about you. This does not include any data we are obliged to keep for administrative, legal, or security purposes.</p>
        </div>
        <div>
          <h4 className="text-gray-200 font-bold mb-1">Where your data is sent</h4>
          <p className="mb-2">Visitor comments may be checked through an automated spam detection service.</p>
        </div>
      </div>
    );
  }

  if (language === 'es') {
    return (
      <div className="text-gray-300 text-xs leading-relaxed space-y-4 font-sans text-justify">
        <h3 className="text-[#dd9933] font-bold text-lg mb-2 text-center">Política de Privacidad</h3>
        <div>
          <h4 className="text-gray-200 font-bold mb-1">Quiénes somos</h4>
          <p className="mb-2">La dirección de nuestra plataforma es: <span className="text-[#dd9933]">https://centralcrypto.com.br/</span></p>
        </div>
        <div>
          <h4 className="text-gray-200 font-bold mb-1">Comentarios</h4>
          <p className="mb-2">Cuando los visitantes dejan comentarios en el sitio, recopilamos los datos que se muestran en el formulario de comentarios, así como la dirección IP del visitante y la cadena de agente de usuario del navegador para ayudar a la detección de spam.</p>
          <p className="mb-2">Una cadena anónima creada a partir de tu dirección de correo electrónico (también llamada hash) puede ser proporcionada al servicio de Gravatar para ver si lo estás usando. La política de privacidad del servicio Gravatar está disponible aquí: https://automattic.com/privacy/. Después de la aprobación de tu comentario, tu foto de perfil es visible para el público en el contexto de tu comentario.</p>
        </div>
        <div>
          <h4 className="text-gray-200 font-bold mb-1">Medios</h4>
          <p className="mb-2">Si subes imágenes al sitio web, deberías evitar subir imágenes con datos de ubicación (GPS EXIF) incluidos. Los visitantes del sitio web pueden descargar y extraer cualquier dato de ubicación de las imágenes del sitio web.</p>
        </div>
        <div>
          <h4 className="text-gray-200 font-bold mb-1">Cookies</h4>
          <p className="mb-2">Si dejas un comentario en nuestro sitio, puedes optar por guardar tu nombre, dirección de correo electrónico y sitio web en cookies. Esto es para tu comodidad, para que no tengas que volver a rellenar tus datos cuando dejes otro comentario. Estas cookies tendrán una duración de un año.</p>
          <p className="mb-2">Si visitas nuestra página de inicio de sesión, estableceremos una cookie temporal para determinar si tu navegador acepta cookies. Esta cookie no contiene datos personales y se descarta cuando cierras el navegador.</p>
          <p className="mb-2">Cuando inicias sesión, también instalaremos varias cookies para guardar tu información de inicio de sesión y tus opciones de visualización de pantalla. Las cookies de inicio de sesión duran dos días, y las cookies de opciones de pantalla duran un año. Si seleccionas "Recordarme", tu inicio de sesión perdurará durante dos semanas. Si sales de tu cuenta, las cookies de inicio de sesión se eliminarán.</p>
          <p className="mb-2">Si editas o publicas un artículo, se guardará una cookie adicional en tu navegador. Esta cookie no incluye datos personales y simplemente indica el ID del artículo que acabas de editar. Vence después de 1 día.</p>
        </div>
        <div>
          <h4 className="text-gray-200 font-bold mb-1">Contenido incrustado de otros sitios web</h4>
          <p className="mb-2">Los artículos de este sitio pueden incluir contenido incrustado (por ejemplo, vídeos, imágenes, artículos, etc.). El contenido incrustado de otras webs se comporta exactamente de la misma manera que si el visitante hubiera visitado la otra web.</p>
          <p className="mb-2">Estas webs pueden recopilar datos sobre ti, utilizar cookies, incrustar un seguimiento adicional de terceros, y supervisar tu interacción con ese contenido incrustado, incluido el seguimiento de tu interacción con el contenido incrustado si tienes una cuenta y estás conectado a esa web.</p>
        </div>
        <div>
          <h4 className="text-gray-200 font-bold mb-1">Con quién compartimos tus datos</h4>
          <p className="mb-2">Si solicitas un restablecimiento de contraseña, tu dirección IP se incluirá en el correo electrónico de restablecimiento.</p>
        </div>
        <div>
          <h4 className="text-gray-200 font-bold mb-1">Cuánto tiempo conservamos tus datos</h4>
          <p className="mb-2">Si dejas un comentario, el comentario y sus metadatos se conservan indefinidamente. Esto es para que podamos reconocer y aprobar comentarios sucesivos automáticamente, en lugar de mantenerlos en una cola de moderación.</p>
          <p className="mb-2">Para los usuarios que se registran en nuestro sitio web, también almacenamos la información personal que proporcionan en su perfil de usuario. Todos los usuarios pueden ver, editar o eliminar su información personal en cualquier momento (excepto que no pueden cambiar su nombre de usuario). Los administradores del sitio web también pueden ver y editar esa información.</p>
        </div>
        <div>
          <h4 className="text-gray-200 font-bold mb-1">Qué derechos tienes sobre tus datos</h4>
          <p className="mb-2">Si tienes una cuenta en este sitio, o has dejado comentarios, puedes solicitar recibir un archivo de exportación de los datos personales que tenemos sobre ti, incluyendo cualquier dato que nos hayas proporcionado. También puedes solicitar que eliminemos cualquier dato personal que tengamos sobre ti. Esto no incluye ningún dato que estemos obligados a conservar con fines administrativos, legales o de seguridad.</p>
        </div>
        <div>
          <h4 className="text-gray-200 font-bold mb-1">Dónde se envían tus datos</h4>
          <p className="mb-2">Los comentarios de los visitantes pueden ser revisados por un servicio de detección automática de spam.</p>
        </div>
      </div>
    );
  }

  // PT
  return (
    <div className="text-gray-300 text-xs leading-relaxed space-y-4 font-sans text-justify">
      <h3 className="text-[#dd9933] font-bold text-lg mb-2 text-center">Política de Privacidade</h3>
      
      <div>
        <h4 className="text-gray-200 font-bold mb-1">Quem somos</h4>
        <p className="mb-2">O endereço da nossa plataforma é: <span className="text-[#dd9933]">https://centralcrypto.com.br/</span></p>
      </div>

      <div>
        <h4 className="text-gray-200 font-bold mb-1">Comentários</h4>
        <p className="mb-2">Quando os visitantes deixam comentários no site, coletamos os dados mostrados no formulário de comentários, além do endereço IP do visitante e da string do agente do usuário do navegador para ajudar na detecção de spam.</p>
        <p className="mb-2">Uma string anonimizada criada a partir do seu endereço de e-mail (também chamada de hash) pode ser fornecida ao serviço Gravatar para verificar se você o está usando. A política de privacidade do serviço Gravatar está disponível aqui: https://automattic.com/privacy/. Após a aprovação do seu comentário, sua foto de perfil fica visível ao público no contexto do seu comentário.</p>
      </div>

      <div>
        <h4 className="text-gray-200 font-bold mb-1">Mídia</h4>
        <p className="mb-2">Se você enviar imagens para o site, evite enviar imagens com dados de localização incorporados (EXIF GPS). Os visitantes do site podem baixar e extrair quaisquer dados de localização das imagens no site.</p>
      </div>

      <div>
        <h4 className="text-gray-200 font-bold mb-1">Cookies</h4>
        <p className="mb-2">Se você deixar um comentário em nosso site, poderá optar por salvar seu nome, endereço de e-mail e site em cookies. Isso é para sua conveniência, para que você não precise preencher seus detalhes novamente ao deixar outro comentário. Esses cookies durarão um ano.</p>
        <p className="mb-2">Se você visitar nossa página de login, definiremos um cookie temporário para determinar se o seu navegador aceita cookies. Este cookie não contém dados pessoais e é descartado quando você fecha o navegador.</p>
        <p className="mb-2">Ao fazer login, também configuraremos vários cookies para salvar suas informações de login e suas opções de exibição de tela. Os cookies de login duram dois dias e os cookies de opções de tela duram um ano. Se você selecionar "Lembrar de mim", seu login persistirá por duas semanas. Se você sair da sua conta, os cookies de login serão removidos.</p>
        <p className="mb-2">Se você editar ou publicar um artigo, um cookie adicional será salvo no seu navegador. Este cookie não inclui dados pessoais e simplesmente indica o ID do post do artigo que você acabou de editar. Ele expira após 1 dia.</p>
      </div>

      <div>
        <h4 className="text-gray-200 font-bold mb-1">Conteúdo incorporado de outros sites</h4>
        <p className="mb-2">Os artigos neste site podem incluir conteúdo incorporado (por exemplo, vídeos, imagens, artigos, etc.). O conteúdo incorporado de outros sites se comporta da mesma maneira como se o visitante estivesse visitando o outro site.</p>
        <p className="mb-2">Esses sites podem coletar dados sobre você, usar cookies, incorporar rastreamento adicional de terceiros e monitorar sua interação com esse conteúdo incorporado, incluindo rastrear sua interação com o conteúdo incorporado se você tiver uma conta e estiver conectado a esse site.</p>
      </div>

      <div>
        <h4 className="text-gray-200 font-bold mb-1">Com quem compartilhamos seus dados</h4>
        <p className="mb-2">Se você solicitar uma redefinição de senha, seu endereço IP será incluído no e-mail de redefinição.</p>
      </div>

      <div>
        <h4 className="text-gray-200 font-bold mb-1">Por quanto tempo retemos seus dados</h4>
        <p className="mb-2">Se você deixar um comentário, o comentário e seus metadatos serão retidos indefinidamente. Isso é para que possamos reconhecer e aprovar automaticamente quaisquer comentários de acompanhamento, em vez de retê-los em uma fila de moderação.</p>
        <p className="mb-2">Para usuários que se registram em nosso site, também armazenamos as informações pessoais que eles fornecem em seus perfis de usuário. Todos os usuários podem ver, editar ou excluir suas informações pessoais a qualquer momento (exceto que não podem alterar seu nome de usuário). Os administradores do site também podem ver e editar essas informações.</p>
      </div>

      <div>
        <h4 className="text-gray-200 font-bold mb-1">Quais direitos você tem sobre seus dados</h4>
        <p className="mb-2">Se você possui uma conta neste site ou deixou comentários, pode solicitar receber um arquivo exportado dos dados pessoais que mantemos sobre você, incluindo quaisquer dados que você nos tenha fornecido. Você também pode solicitar que apaguemos quaisquer dados pessoais que mantemos sobre você. Isso não inclui quaisquer dados que somos obrigados a manter para fins administrativos, legais ou de segurança.</p>
      </div>

      <div>
        <h4 className="text-gray-200 font-bold mb-1">Para onde enviamos seus dados</h4>
        <p className="mb-2">Os comentários dos visitantes podem ser verificados por um serviço automatizado de detecção de spam.</p>
      </div>
    </div>
  );
};

export default PrivacyContent;
