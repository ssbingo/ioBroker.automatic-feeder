![Logo](../../admin/automatic-feeder.png)
# ioBroker.automatic-feeder

<p align="center">
  <a href="https://www.buymeacoffee.com/ssbingo"><img src="https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&emoji=&slug=ssbingo&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff" /></a>
</p>

## Adaptador automatic-feeder para ioBroker

Este adaptador transforma qualquer interruptor já existente no ioBroker (uma
tomada, um relé, uma saída GPIO …) num **alimentador automático controlado por tempo**. Ele
liga a saída nos horários que você definir, por um número determinado de segundos,
podendo levar em conta a temperatura e a alternância dia/noite, para que nunca se alimente
na hora errada.

Este documento é um guia completo. Se você nunca usou o adaptador,
leia-o de cima para baixo – o **Início rápido** o leva à primeira
alimentação em poucos minutos, e o restante explica cada configuração em detalhe.

---

## Índice

1. [O que o adaptador faz](#1-o-que-o-adaptador-faz)
2. [Pré-requisitos](#2-pré-requisitos)
3. [Instalação](#3-instalação)
4. [Início rápido](#4-início-rápido--a-primeira-alimentação)
5. [A página de configurações em detalhe](#5-a-página-de-configurações-em-detalhe)
6. [Objetos / Pontos de dados](#6-objetos--pontos-de-dados)
7. [Exemplos / Receitas](#7-exemplos--receitas)
8. [Notificações do Telegram](#8-notificações-do-telegram)
9. [Solução de problemas & FAQ](#9-solução-de-problemas--faq)
10. [Logging & Diagnóstico](#10-logging--diagnóstico)

---

## 1. O que o adaptador faz

Uma „alimentação" é, no fundo, bem simples: **saída LIGA → aguardar um número ajustável de
segundos → DESLIGA novamente**. Num alimentador automático adaptado, o motor funciona durante esse
tempo e libera ração.

O adaptador gerencia **até 5 interruptores**, cada um totalmente independente e com sua própria
aba de configuração, nomeada conforme o interruptor. Para cada interruptor você define:

* **quando** alimentar – seja em **horários fixos** (p. ex. 08:00 e 18:00) ou em
  **intervalo** dentro de uma janela de tempo (p. ex. a cada 60 minutos entre 08:00 e 18:00);
* **por quanto tempo** a saída permanece ligada (duração da alimentação em segundos);
* **se há bloqueio** quando a temperatura da água ou do ar estiver muito baixa/alta;
* **se à noite** não se alimenta (com base no nascer/pôr do sol real para a sua
  localização);
* **se o processo de comutação é monitorado** (verificação de que realmente houve liga e
  desliga) e, opcionalmente, é enviada uma mensagem do **Telegram** com o resultado;
* **se reduzir ou pausar** a alimentação durante uma temporada de **inverno** recorrente –
  opcionalmente com lembretes do Telegram antes de começar e de terminar;
* **se adaptar** o intervalo e a porção automaticamente à temperatura da água/do ar
  (**alimentação dinâmica**, modelo Q10);
* **se bloquear** a alimentação quando o **oxigénio** dissolvido (O₂) estiver muito baixo.

Você pode acionar uma alimentação **manualmente** a qualquer momento – diretamente na página de
configurações (botão com duração livremente selecionável) ou através de um ponto de dados (p. ex. um
botão numa visualização VIS).

> Importante: O adaptador não cria o interruptor por conta própria. Ele **controla um objeto já
> existente** no seu ioBroker. Esse objeto você seleciona na configuração.

---

## 2. Pré-requisitos

| Você precisa de | Detalhes |
|-------------|---------|
| **ioBroker** com **admin** atual (≥ 7) | A página de configuração é implementada com React. |
| **Um objeto de interruptor** | Um ponto de dados gravável do ioBroker que liga/desliga o alimentador automático – p. ex. uma tomada (`shelly.0.…`, `sonoff.0.…`, `zigbee.0.…`), um relé ou uma variável de script. |
| **Coordenadas geográficas** | Para o cálculo do nascer/pôr do sol. Seja a partir das configurações de sistema do ioBroker ou por endereço/mapa. **Obrigatório.** |
| *(opcional)* Objetos de temperatura | Pontos de dados existentes com temperatura do ar e/ou da água, para o bloqueio por temperatura ou a alimentação dinâmica. Atribuídos **por interruptor** na aba do interruptor. |
| *(opcional)* Objetos de **oxigénio (O₂)** | Pontos de dados existentes com o oxigénio dissolvido, para bloquear a alimentação quando ele cair demais. Atribuídos **por interruptor**. |
| *(opcional)* Uma instância do **Telegram** | O adaptador oficial `telegram`, configurado e iniciado, caso você queira notificações push. |
| Acesso à internet no host do ioBroker | Apenas para a busca de endereço/mapa na configuração. A operação normal funciona offline. |

---

## 3. Instalação

1. No **admin** do ioBroker, abrir a aba **Adaptadores** (Adapter).
2. Localizar **automatic-feeder** na lista de adaptadores e clicar em **Instalar**.
3. Criar uma **instância** do adaptador.
4. Abrir as configurações da instância (ícone de engrenagem) – deve aparecer a página de
   configuração com a aba **Configurações básicas** (Grundeinstellungen). Se ela ficar vazia, ver [Solução de problemas](#9-solução-de-problemas--faq).

---

## 4. Início rápido – a primeira alimentação

Objetivo: Um interruptor deve – imediatamente, para teste – alimentar por 5 segundos.

1. **Abrir as configurações** da instância automatic-feeder.
2. Na aba **Configurações básicas** (Grundeinstellungen):
   * Em **Localização**, deixar *Adotar configurações de sistema*, se o seu ioBroker já tiver
     coordenadas. Caso contrário, escolher *Definir localização específica*, inserir o endereço,
     clicar em **Buscar** e confirmar o marcador no mapa.
   * Rolar para baixo até **Interruptores** e clicar em **Adicionar interruptor**.
   * Atribuir um **Nome** (p. ex. `Koi-Teich`). Esse nome se torna o título de uma aba própria.
   * Ao lado de **Objeto de interruptor**, clicar no ícone de lista e escolher o ponto de dados que aciona
     o seu alimentador (p. ex. a sua tomada). O interruptor deve estar **ativo** (caixa marcada à esquerda).
3. **Salvar** (disquete/visto na parte inferior). Aparece uma nova aba com o nome do seu interruptor.
4. Abrir essa **aba do interruptor**. Bem no topo, em **Alimentação manual**, ajustar uma duração
   (p. ex. `5` segundos) e clicar em **Alimentar agora**. A saída deve ligar por 5 segundos e
   depois desligar novamente.
5. Na mesma aba, configurar o cronograma real em **Plano de alimentação** (p. ex. horários fixos
   08:00 e 18:00) e definir a **Duração da alimentação** em **Processo de alimentação**, depois
   **Salvar**.

Pronto – a partir de agora o adaptador alimenta automaticamente. Todo o resto explica as opções em detalhe.

---

## 5. A página de configurações em detalhe

A configuração tem uma aba **Configurações básicas** (Grundeinstellungen), bem como **uma aba por interruptor** (é
criada automaticamente assim que um interruptor recebe um nome). Caso uma página não role, ampliar a
janela ou usar a barra de rolagem à direita – todas as seções são acessíveis.

### 5.1 Aba „Configurações básicas" (Grundeinstellungen)

#### Localização (obrigatório)

O adaptador precisa da sua posição geográfica para calcular o nascer e o pôr do sol (para
o bloqueio noturno). Duas possibilidades:

* **Adotar configurações de sistema** – usa latitude/longitude da configuração de sistema do ioBroker
  (recomendado, se já estiver definida lá). Os valores atuais são exibidos.
* **Definir localização específica** – determinar a posição você mesmo:
  * Inserir um **endereço** e pressionar **Buscar**. O adaptador o resolve (via
    OpenStreetMap / Nominatim) e define um marcador.
  * Ou **clicar no mapa** / **arrastar o marcador** para escolher o local exato.
  * Latitude/longitude também podem ser inseridas diretamente; o mapa acompanha.

> A busca de endereço é executada no backend do adaptador, portanto a **instância precisa estar em
> execução**. Mapa e busca exigem acesso à internet.

#### Janela solar (sem alimentação à noite)

Define a janela de tempo na qual é permitido alimentar:

* **Minutos após o nascer do sol** – só alimentar tantos minutos *após* o nascer do sol.
* **Minutos antes do pôr do sol** – parar tantos minutos *antes* do pôr do sol.

Exemplo: Com nascer do sol às 06:30, pôr do sol às 21:00 e offsets de 30 / 30, a alimentação só é
permitida entre **07:00 e 20:30**. Cada interruptor pode considerar ou ignorar essa janela
individualmente (ver *Restrições* na aba do interruptor). Os horários calculados também constam nos
pontos de dados `sunrise` / `sunset` e são recalculados automaticamente todas as noites.

#### Interruptores

A lista dos alimentadores automáticos (até 5). Por entrada:

* **Ativo** (caixa) – apenas interruptores ativos são planejados.
* **Nome** – texto livre; torna-se o título da aba do interruptor e o nome do canal na árvore de objetos.
* **Objeto de interruptor** – o ponto de dados existente do ioBroker que é controlado. Selecionar
  através do ícone de lista, limpar através da cruz.

Com **Adicionar interruptor** você cria mais um (máx. 5), com o ícone da lixeira você
remove um. Ao remover, também são excluídos os pontos de dados dele.

### 5.2 Abas dos interruptores

Cada interruptor configurado recebe uma aba própria com seu nome. Ela contém as seguintes
seções.

#### Alimentação manual

* **Duração da alimentação manual (segundos)** – a duração usada pelo botão.
* **Alimentar agora** – aciona imediatamente uma alimentação com essa duração. Prático para testes ou
  para uma porção extra. (Se os bloqueios são ignorados depende de *O acionador manual ignora
  todos os bloqueios* em *Restrições*.)
* Para o botão, a instância precisa estar em execução e a configuração precisa estar **salva**.

#### Plano de alimentação

Escolher **um** modo:

* **Horários fixos** – uma lista de horários (`HH:mm`). Adicionar quantos quiser; o
  alimentador funciona diariamente em cada um deles. Exemplo: `08:00` e `18:00`.
* **Intervalo dentro de um período** – alimentar repetidamente dentro de uma janela:
  * **Início do período** / **Fim do período** – p. ex. 08:00 até 18:00.
  * **Intervalo (minutos)** – p. ex. 60 → alimenta diariamente às 08:00, 09:00, … até o fim da janela.

O próximo horário planejado consta a qualquer momento no ponto de dados `nextFeeding`.

#### Processo de alimentação

* **Duração da alimentação (segundos)** – por quanto tempo a saída permanece LIGADA numa alimentação planejada.
* **Valor de ligado** / **Valor de desligado** – os valores que são gravados no objeto de interruptor.
  O padrão é `true` e `false`, o que combina com a maioria das tomadas/relés. Se o seu
  dispositivo espera números ou texto, inserir aqui p. ex. `1` / `0` ou `ON` / `OFF`.

#### Fontes de temperatura & oxigénio

Cada interruptor (estação de alimentação) tem os **seus próprios** sensores – lagos/tanques diferentes podem usar objetos diferentes:

* **Temperatura do ar** – marcar a caixa e selecionar o ponto de dados que contém a temperatura do ar desta estação.
* **Temperatura da água** – marcar a caixa e selecionar o ponto de dados que contém a temperatura da água desta estação.
* **Oxigénio (O₂)** – marcar a caixa e selecionar o ponto de dados que contém o oxigénio dissolvido.

Só fazem sentido pontos de dados numéricos. Os valores atuais são espelhados nos pontos de dados `airTemperature`, `waterTemperature` e `oxygen` deste interruptor. Os limites são definidos abaixo (*Bloqueio por temperatura*), e as temperaturas também alimentam a *Alimentação dinâmica*.

#### Bloqueio por temperatura

É exibido apenas para as fontes de temperatura ativadas acima (*Fontes de temperatura & oxigénio*). Por interruptor:

* **Bloquear por temperatura da água** – *Bloquear se abaixo de* e/ou *Bloquear se acima de* (°C).
* **Bloquear por temperatura do ar** – o mesmo para o ar.

Se a temperatura atual estiver fora da faixa permitida, a alimentação é ignorada
e o motivo é gravado em `blockReason`. (Se um valor de temperatura for desconhecido, essa
fonte não bloqueia.)

#### Restrições

* **Não alimentar à noite** – considera a janela solar (incluindo os offsets). Desativar, se
  este interruptor puder alimentar 24 horas por dia.
* **O acionador manual ignora todos os bloqueios** – quando ativo, o botão e o
  ponto de dados `feedNow` alimentam mesmo com bloqueio de temperatura/noturno ativo.

#### Alimentação dinâmica

Opcional: adapta o **intervalo e a duração da alimentação à temperatura** com o modelo Q10 (o metabolismo praticamente duplica a cada +10 °C). Requer uma fonte de temperatura ativa; os horários fixos são então substituídos por um intervalo dentro da janela.

* **Ativar / fonte** – ative e escolha a temperatura da água ou do ar.
* **Referência / Q10** – o intervalo e a duração base aplicam-se à temperatura de referência (p. ex. 20 °C); Q10 normalmente 2–2,5.
* **Intervalo / duração (base, mín, máx)** – limites para o intervalo calculado (minutos) e a duração (segundos).
* **Janela de média / histerese** – uma média móvel (p. ex. 24 h) suaviza picos; a histerese evita replaneamento por mudanças mínimas.

Os valores atuais estão em `dynamicAvgTemperature`, `dynamicRate`, `dynamicIntervalMin` e `dynamicDurationSec`. Uma fonte opcional de **oxigénio (O₂)** pode bloquear a alimentação quando o oxigénio dissolvido cai abaixo de um limite. A pausa de inverno tem prioridade sobre a alimentação dinâmica.

#### Pausa de inverno

Para cada interruptor pode definir uma **pausa de inverno** recorrente (sazonal, como datas `MM-DD` que se repetem todos os anos e podem atravessar o Ano Novo).

* **Ativar pausa de inverno** – ligar a pausa.
* **Início / Fim do inverno** – escolha o dia e o mês num calendário (mostrado como dd.mm), por exemplo de 01.11 a 15.03.
* **Modo** – durante a pausa, **suspender a alimentação**, alimentar com um intervalo próprio **reduzido** ou **uma vez por dia** a uma hora definida; aplica-se uma **duração de alimentação de inverno** própria.
* **Lembretes (Telegram)** – nos dias antes do início e antes do fim é enviado diariamente (a última vez no próprio dia) um lembrete à hora configurada. Precisa de uma instância do Telegram (veja abaixo).

O estado atual é mostrado no ponto de dados `winterActive`. A alimentação recomeça automaticamente quando a pausa termina.

#### Monitoramento de comutação

Após a comutação, o adaptador pode verificar se o interruptor **realmente** atingiu os estados
de ligado e desligado, e reporta por alimentação um de três resultados:

| Resultado | Significado | Mensagem |
|----------|-----------|---------|
| ✅ Sucesso | O interruptor ligou e desligou conforme esperado | „Alimentação acionada por x s." |
| ❌ Falha ao ligar | O interruptor nunca confirmou o estado LIGADO | „Não foi possível alimentar. Verifique o interruptor!" |
| ❌ Falha ao desligar | Ele ligou, mas não desligou novamente | „Falha: o alimentador não desligou!" |

> A mensagem é enviada no idioma do sistema ioBroker configurado (inglês por padrão).


* **Verificar se o interruptor realmente liga e desliga** – ativa o monitoramento.
* **Timeout do monitoramento (segundos)** – por quanto tempo se aguarda a confirmação.
* **Tentativas de verificação** – quantas reverificações escalonadas são feitas antes de relatar uma falha (padrão 3). Cada tentativa também lê o estado atual de volta, de modo que o retorno atrasado (por exemplo, rádio Homematic) não gera mais uma falha falsa.

> **Importante:** O monitoramento só funciona se o interruptor **reportar o seu estado real**,
> ou seja, o objeto de destino é atualizado com `ack=true` (típico de
> tomadas/relés com retorno de status). Um simples booleano auxiliar, que ninguém confirma,
> sempre reportaria uma falha – nesse caso, desativar o monitoramento para esse interruptor.

O resultado também consta nos pontos de dados `lastResult` (texto) e `error` (boolean),
de modo que você possa reagir a ele (p. ex. acionar uma notificação própria).

#### Notificações do Telegram

Envia as mensagens do monitoramento de comutação para o Telegram – configurado **por interruptor**:

* **Instância do Telegram** – escolher uma das instâncias `telegram.*` instaladas (ou *Nenhuma*, para
  desativar o Telegram para esse interruptor). Se nenhuma estiver instalada, o campo indica isso.
* **Destinatário do Telegram (opcional)** – um determinado nome de usuário/chat, conforme configurado
  no adaptador telegram; deixar vazio para enviar a todos os destinatários configurados.
* **Caixas de seleção** – selecionar quais mensagens são enviadas: alimentação bem-sucedida, não
  executável e/ou falha de desligamento.

Os **lembretes da pausa de inverno** (se ativados, ver *Pausa de inverno*) são enviados para a mesma
instância do Telegram, independentemente dessas caixas de seleção do monitoramento.

A configuração completa consta em [Notificações do Telegram](#8-notificações-do-telegram).

---

## 6. Objetos / Pontos de dados

O adaptador cria os seguintes pontos de dados no seu namespace
(`automatic-feeder.<instanz>.`).

**Global**

| Ponto de dados | Tipo | Significado |
|------------|-----|-----------|
| `info.connection` | boolean (ro) | O adaptador está em execução e a configuração é válida. |
| `sunrise` / `sunset` | string (ro) | Nascer/pôr do sol calculado para hoje. |

**Por interruptor em `switches.<id>.`** (`<id>` é um ID interno como `sw-0`)

Além disso, um subcanal somente leitura **`settings`** (`switches.<id>.settings.*`) espelha a configuração deste interruptor para que possa ser exibida no VIS ou usada em scripts.

| Ponto de dados | Tipo | Significado |
|------------|-----|-----------|
| `feedingActive` | boolean (ro) | Uma alimentação está em andamento no momento. |
| `lastFeeding` | string (ro) | Momento da última alimentação. |
| `nextFeeding` | string (ro) | Momento da próxima alimentação planejada. |
| `blocked` | boolean (ro) | A última tentativa foi bloqueada. |
| `blockReason` | string (ro) | Motivo do bloqueio (noite / temperatura / oxigénio). |
| `lastResult` | string (ro) | Texto de resultado da última tentativa de alimentação. |
| `error` | boolean (ro) | A última tentativa teve uma falha de comutação. |
| `feedNow` | boolean (rw) | Gravar `true` para alimentar manualmente. |
| `winterActive` | boolean (ro) | A pausa de inverno está ativa no momento. |
| `winterLastStartReminder` | string (ro) | Data do último lembrete de „início do inverno" enviado. |
| `winterLastEndReminder` | string (ro) | Data do último lembrete de „fim do inverno" enviado. |
| `dynamicAvgTemperature` | number (ro) | Temperatura média usada pela alimentação dinâmica. |
| `dynamicRate` | number (ro) | Fator de taxa Q10 atualmente aplicado pela alimentação dinâmica. |
| `dynamicIntervalMin` | number (ro) | Intervalo dinâmico atualmente calculado (minutos). |
| `dynamicDurationSec` | number (ro) | Duração dinâmica atualmente calculada (segundos). |
| `airTemperature` | number (ro) | Valor da fonte de temperatura do ar própria deste interruptor. |
| `waterTemperature` | number (ro) | Valor da fonte de temperatura da água própria deste interruptor. |
| `oxygen` | number (ro) | Valor da fonte de oxigénio dissolvido própria deste interruptor. |

Esses pontos de dados podem ser usados em VIS, scripts ou outros adaptadores – p. ex. exibir `nextFeeding`
num dashboard ou acionar um alarme próprio quando `error = true`.

---

## 7. Exemplos / Receitas

**Lago de carpas Koi, duas vezes ao dia, apenas com calor suficiente**
* Modo *Horários fixos* → `08:00`, `18:00`; duração `6` s.
* Na aba do interruptor, em *Fontes de temperatura & oxigénio*, ativar *Temperatura da água* e
  selecionar o sensor; depois *Bloquear por temperatura da água* → *Bloquear se abaixo de* `8` °C (sem alimentação com a água muito fria).
* Ativar *Não alimentar à noite*.

**Viveiro de aves, porções pequenas e frequentes durante o dia**
* Modo *Intervalo dentro de um período* → 07:00–19:00, intervalo `90` min; duração `3` s.

**Lago de carpas Koi, adaptativo à temperatura (alimentação dinâmica)**
* Na aba do interruptor, em *Fontes de temperatura & oxigénio*, ativar *Temperatura da água* e selecionar o sensor.
* Depois abrir *Alimentação dinâmica*, ativá-la, fonte *Temperatura da água*.
* Referência `20` °C, Q10 `2,2`, intervalo base `60` min (mín `30`, máx `480`), duração base `5` s
  (mín `2`, máx `15`). Ele então alimenta com mais frequência e um pouco mais quando está quente, e
  menos quando está frio.

**Pausa de inverno para o lago**
* Na aba do interruptor, abrir *Pausa de inverno*, ativá-la, definir *Início do inverno* `01.11` e
  *Fim do inverno* `15.03`, modo *Suspender a alimentação*.
* Opcionalmente marcar os lembretes para receber um aviso do Telegram alguns dias antes do início/fim.

**Porção extra manual via botão VIS**
* Criar no VIS um botão que grave `true` em `automatic-feeder.0.switches.sw-0.feedNow`.
* Opcionalmente ativar *O acionador manual ignora todos os bloqueios*, para que sempre se alimente.

---

## 8. Notificações do Telegram

1. Instalar e configurar o adaptador **telegram** (criar bot com @BotFather, inserir o
   token, iniciar o chat com o bot). A instância do Telegram precisa estar **em execução**.
2. Numa **aba de interruptor** do automatic-feeder, abrir a seção **Notificações do Telegram**:
   * Selecionar a **Instância do Telegram** no dropdown (p. ex. `telegram.0`).
   * Opcionalmente, inserir um **Destinatário** (o nome de usuário/chat exibido no adaptador telegram);
     deixar vazio para notificar a todos.
   * Marcar as mensagens desejadas: *alimentação bem-sucedida*, *não executável*,
     *falha de desligamento*.
3. Salvar. A partir de agora, os resultados de monitoramento selecionados são enviados ao Telegram (com o
   nome do interruptor antes). O pré-requisito é que o *Monitoramento de comutação* esteja ativado para
   esse interruptor.
4. Os **lembretes da pausa de inverno** usam a mesma instância e o mesmo destinatário do Telegram. Eles
   são controlados na seção *Pausa de inverno* (dias antes do início/fim e a hora do lembrete) e **não**
   exigem que o monitoramento esteja ativado.

---

## 9. Solução de problemas & FAQ

**A página de configurações está vazia / em branco.**
Recarregar o navegador com **Strg+Shift+R**. Se o problema persistir, reiniciar a
instância e reabrir as configurações.

**O novo ícone / uma alteração não aparece.**
Cache do navegador. Recarregar de forma forçada com **Strg+Shift+R**.

**Não se alimenta de modo algum.**
Verificar em ordem: interruptor **Ativo**; um **Objeto de interruptor** selecionado; **Cronograma**
válido (`nextFeeding` mostra um horário); não **bloqueado** (observar `blocked` / `blockReason`);
a **janela solar** não exclui o horário; definir o **nível de log** da instância para `debug`
e observar o log.

**Nunca se alimenta à noite, embora eu queira.**
Ou desativar *Não alimentar à noite* para esse interruptor ou ajustar os offsets solares.
Sem coordenadas válidas, o bloqueio noturno fica desativado (e é registrada uma advertência
no log).

**O monitoramento sempre reporta uma falha.**
Provavelmente o seu objeto de interruptor não reporta o seu estado real (`ack=true`). Ou
usar um interruptor com retorno de status ou desativar o *Monitoramento de comutação* para esse
interruptor.

**A alimentação dinâmica não muda nada.**
Certifique-se de que a fonte de temperatura selecionada (água ou ar) está ativada na aba do
interruptor (*Fontes de temperatura & oxigénio*) e fornece valores. Logo após uma reinicialização, a
média móvel ainda está a encher-se, por isso começa a partir dos valores base. Observe
`dynamicAvgTemperature` e `dynamicIntervalMin`.

**Nada é alimentado embora não seja inverno (ou alimenta embora devesse pausar).**
Verifique as datas da *Pausa de inverno* (`Início do inverno` / `Fim do inverno`, formato dd.mm) e o
modo. O ponto de dados `winterActive` mostra se a pausa está ativa no momento.

**A busca de endereço diz que a instância precisa estar em execução.**
Iniciar a instância automatic-feeder – o geocoding é executado no backend.

**As mensagens do Telegram não chegam.**
Há uma instância do Telegram selecionada na aba do interruptor? O adaptador telegram está configurado e
iniciado? Pelo menos um tipo de mensagem está marcado e o *Monitoramento de comutação* está ativado?

---

## 10. Logging & Diagnóstico

O adaptador registra nos níveis usuais do ioBroker. Para mensagens detalhadas, elevar o nível de log da
instância (Instâncias → automatic-feeder.x → Nível de log) para **debug** ou **silly**:

* **error** – erros que requerem atenção (p. ex. falha ao gravar no
  interruptor).
* **warn** – configuração incorreta (sem coordenadas, cronograma inválido …).
* **info** – marcos (início, uma alimentação executada ou bloqueada, acionador manual).
* **debug** – fluxo detalhado (decisões de planejamento, atualizações de temperatura, geocoding,
  valores de ligado/desligado, verificação confirmada/timeout).
* **silly** – rastreamento muito detalhado (cada timer, cada verificação de bloqueio, cada mudança de estado).

---

📖 [Documentação principal (inglês)](../../README.md)
