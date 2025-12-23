
import React from 'react';

const PrivacyContent: React.FC = () => {
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
        <p className="mb-2">Se você deixar um comentário, o comentário e seus metadados serão retidos indefinidamente. Isso é para que possamos reconhecer e aprovar automaticamente quaisquer comentários de acompanhamento, em vez de retê-los em uma fila de moderação.</p>
        <p className="mb-2">Para usuários que se registram em nosso site, também armazenamos as informações pessoais que eles fornecem em seus perfis de usuário. Todos os usuários podem ver, editar ou excluir suas informações pessoais a qualquer momento (exceto que não podem alterar seu nome de usuário). Os administradores do site também podem ver e editar essas informações.</p>
      </div>

      <div>
        <h4 className="text-gray-200 font-bold mb-1">Quais direitos você tem sobre seus dados</h4>
        <p className="mb-2">Se você possui uma conta neste site ou deixou comentários, pode solicitar receber um arquivo exportado dos dados pessoais que mantemos sobre você, incluindo quaisquer dados que você nos tenha fornecido. Você também pode solicitar que apaguemos quaisquer dados pessoais que mantenhamos sobre você. Isso não inclui quaisquer dados que somos obrigados a manter para fins administrativos, legais ou de segurança.</p>
      </div>

      <div>
        <h4 className="text-gray-200 font-bold mb-1">Para onde enviamos seus dados</h4>
        <p className="mb-2">Os comentários dos visitantes podem ser verificados por um serviço automatizado de detecção de spam.</p>
      </div>
    </div>
  );
};

export default PrivacyContent;
