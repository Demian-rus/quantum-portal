'use strict';
// Stable authored questions. Keep IDs and historical snapshots when editing the catalog.
// Calendar, geometry and counting answers follow definitions/formulas; empirical facts
// link to the institution publishing them. Rounding and anatomical conventions are explicit.
const QUIP_APPROX_SOURCES=Object.freeze({
 bones:'https://training.seer.cancer.gov/anatomy/skeletal/divisions/',
 planets:'https://science.nasa.gov/solar-system/planets/',
 constants:'https://www.bipm.org/en/measurement-units/si-defining-constants',
 units:'https://www.bipm.org/en/measurement-units/si-base-units',
 piano:'https://www.yamaha.com/en/musical_instrument_guide/piano/trivia/trivia007.html',
 strings:'https://www.yamaha.com/en/musical_instrument_guide/acoustic_guitar/trivia/trivia006.html',
 chromosomes:'https://www.genome.gov/genetics-glossary/Chromosome',
 marathon:'https://worldathletics.org/disciplines/race-walks/marathon',
 elements:'https://iupac.org/what-we-do/periodic-table-of-elements/',
 mercury:'https://science.nasa.gov/mercury/facts/',venus:'https://science.nasa.gov/venus/venus-facts/',
 neptune:'https://science.nasa.gov/neptune/neptune-facts/',apollo:'https://science.nasa.gov/moon/moon-walkers/',
 heart:'https://www.nhlbi.nih.gov/health/heart/anatomy',chess:'https://handbook.fide.com/chapter/e012023',
 octopus:'https://ocean.si.edu/ocean-life/invertebrates/octopuses-squids-and-relatives',
 insect:'https://naturalhistory.si.edu/education/teaching-resources/life-science/what-insect',
 rings:'https://www.olympics.com/ioc/olympic-rings',
 gagarin:'https://www.nasa.gov/image-article/an-historic-day-human-spaceflight/',
 sputnik:'https://www.nasa.gov/history/dawn-of-the-space-age/',
 teeth:'https://www.ncbi.nlm.nih.gov/books/NBK553376/'
});
const QUIP_APPROX_QUESTIONS=Object.freeze([
 // id, tier, question, numeric answer, units, categories, note, source key or derivation
 ['0001','easy','Сколько месяцев в календарном году?','12','','general','','definition:calendar'],
 ['0002','easy','Сколько минут в одном часе?','60','минут','science','','definition:time'],
 ['0003','easy','Сколько секунд в одной минуте?','60','секунд','science','','definition:time'],
 ['0004','easy','Сколько дней в неделе?','7','дней','general','','definition:calendar'],
 ['0005','easy','Сколько дней в високосном году григорианского календаря?','366','дней','science','','definition:calendar'],
 ['0006','easy','Сколько градусов в прямом угле?','90','°','science','','definition:geometry'],
 ['0007','easy','Сколько граней у куба?','6','','science','','definition:geometry'],
 ['0008','easy','Сколько сторон у треугольника?','3','','science','','definition:geometry'],
 ['0009','easy','Сколько ног у взрослого насекомого?','6','','biology,animals','','insect'],
 ['0010','easy','Сколько ног у паука?','8','','biology,animals','','insect'],
 ['0011','easy','Сколько сердец у осьминога?','3','','biology,animals','','octopus'],
 ['0012','easy','Сколько камер в сердце человека?','4','','biology','','heart'],
 ['0013','easy','Сколько костей обычно указывают в стандартном скелете взрослого человека?','206','','biology','Индивидуальные анатомические варианты возможны.','bones'],
 ['0014','easy','Сколько планет в Солнечной системе по классификации с 2006 года?','8','','science','Плутон относится к карликовым планетам.','planets'],
 ['0015','easy','Сколько всего атомов в одной молекуле воды H₂O?','3','','science','','formula:2+1'],
 ['0016','easy','При какой температуре кипит чистая вода при нормальном атмосферном давлении, если округлить до целого °C?','100','°C','science','Нормальное давление — 101 325 Па.','definition:water-at-1-atm'],
 ['0017','easy','При какой температуре замерзает чистая вода при нормальном давлении, если округлить до целого °C?','0','°C','science','','definition:water-at-1-atm'],
 ['0018','easy','Сколько полутонов в октаве при равномерной двенадцатиступенной темперации?','12','','culture','Речь о стандартном западном музыкальном строе.','definition:12-tone-temperament'],
 ['0019','easy','Сколько струн у стандартной классической гитары?','6','','culture','','strings'],
 ['0020','easy','Сколько клеток на стандартной шахматной доске?','64','','culture','8 × 8.','chess'],
 ['0021','medium','Сколько секунд в 24 часах?','86400','секунд','science','24 × 60 × 60.','formula:24*60*60'],
 ['0022','medium','Сколько кубических сантиметров в одном литре?','1000','см³','science','Литр равен одному кубическому дециметру.','formula:10**3'],
 ['0023','medium','Сколько рёбер у куба?','12','','science','','definition:geometry'],
 ['0024','medium','Сколько диагоналей у выпуклого шестиугольника?','9','','science','n(n − 3) / 2 при n = 6.','formula:6*(6-3)/2'],
 ['0025','medium','Чему равна сумма внутренних углов выпуклого пятиугольника?','540','°','science','(n − 2) × 180° при n = 5.','formula:(5-2)*180'],
 ['0026','medium','Сколько клавиш у стандартного современного фортепиано?','88','','culture','','piano'],
 ['0027','medium','Сколько белых клавиш на стандартной клавиатуре фортепиано из 88 клавиш?','52','','culture','Семь полных октав и крайние ля, си, до: 7 × 7 + 3.','piano'],
 ['0028','medium','Сколько струн у стандартной скрипки?','4','','culture','','strings'],
 ['0029','medium','Сколько колец на олимпийском символе?','5','','culture','','rings'],
 ['0030','medium','Сколько метров составляет официальная марафонская дистанция?','42195','метров','culture','42 км 195 м.','marathon'],
 ['0031','medium','Сколько химических элементов было официально названо к концу 2016 года?','118','','science','В 2016 году утверждены названия элементов 113, 115, 117 и 118.','elements'],
 ['0032','medium','Сколько протонов в ядре атома углерода?','6','','science','Это атомный номер углерода.','elements'],
 ['0033','medium','Сколько протонов в ядре атома кислорода?','8','','science','Это атомный номер кислорода.','elements'],
 ['0034','medium','Сколько хромосом в обычном диплоидном наборе ядерной клетки человека?','46','','biology','23 пары; не речь о половых клетках.','chromosomes'],
 ['0035','medium','Сколько зубов в полном постоянном наборе человека, включая все зубы мудрости?','32','','biology','Полный набор, а не фактическое число зубов у любого взрослого.','teeth'],
 ['0036','medium','Сколько пар рёбер обычно в скелете человека?','12','пар','biology','Стандартный анатомический вариант.','bones'],
 ['0037','medium','В каком году состоялся полёт Юрия Гагарина в космос?','1961','год','history,science','12 апреля.','gagarin'],
 ['0038','medium','В каком году люди впервые высадились на Луну?','1969','год','history,science','«Аполлон-11», 20 июля.','apollo'],
 ['0039','medium','В каком году был запущен первый искусственный спутник Земли «Спутник-1»?','1957','год','history,science','4 октября.','sputnik'],
 ['0040','medium','Сколько периодов в таблице химических элементов, завершённой элементом 118?','7','','science','','elements'],
 ['0041','hard','Какова точная скорость света в вакууме в метрах в секунду?','299792458','м/с','science','Точное определяющее значение в СИ.','constants'],
 ['0042','hard','Сколько различных двоичных последовательностей длиной 10 бит существует?','1024','','science','2¹⁰.','formula:2**10'],
 ['0043','hard','Чему равен абсолютный ноль температуры в градусах Цельсия?','−273,15','°C','science','0 К.','units'],
 ['0044','hard','Сколько периодов излучения перехода атома цезия-133 определяют секунду в СИ?','9192631770','','science','Частота невозмущённого сверхтонкого перехода основного состояния.','constants'],
 ['0045','hard','Чему равна постоянная Авогадро в обратных молях?','6,02214076 × 10²³','моль⁻¹','science','Точное определяющее значение в СИ.','constants'],
 ['0046','hard','Сколько земных суток длится оборот Меркурия вокруг Солнца, округлённо до целого?','88','суток','science','','mercury'],
 ['0047','hard','Сколько земных суток длится оборот Венеры вокруг Солнца, округлённо до целого?','225','суток','science','Речь о годе, а не о вращении вокруг оси.','venus'],
 ['0048','hard','Сколько земных лет длится оборот Нептуна вокруг Солнца, округлённо до целого?','165','лет','science','','neptune'],
 ['0049','hard','Сколько астронавтов ходили по поверхности Луны в рамках программы «Аполлон»?','12','','history,science','Шесть высадок в 1969–1972 годах.','apollo'],
 ['0050','hard','Сколько костей в стандартном осевом скелете взрослого человека?','80','','biology','Череп, позвоночный столб и грудная клетка в анатомическом перечне.','bones'],
 ['0051','hard','Сколько костей в стандартном добавочном скелете взрослого человека?','126','','biology','Конечности и их пояса.','bones'],
 ['0052','hard','Сколько граней у правильного додекаэдра?','12','','science','','definition:geometry'],
 ['0053','hard','Сколько вершин у правильного икосаэдра?','12','','science','','definition:geometry'],
 ['0054','hard','Сколько диагоналей у выпуклого восьмиугольника?','20','','science','n(n − 3) / 2 при n = 8.','formula:8*(8-3)/2'],
 ['0055','hard','Сколькими способами можно расставить пять разных книг в один ряд?','120','','science','5! = 5 × 4 × 3 × 2 × 1.','formula:5*4*3*2*1'],
 ['0056','hard','Сколько различных значений можно закодировать восемью битами?','256','','science','2⁸.','formula:2**8'],
 ['0057','hard','Сколько клавиш было у первого фортепиано Бартоломео Кристофори согласно истории инструмента Yamaha?','54','','culture,history','Ранний инструмент имел меньший диапазон, чем современный.','piano'],
 ['0058','hard','Сколько секунд в двух часах и 35 минутах?','9300','секунд','science','2 × 3600 + 35 × 60.','formula:2*3600+35*60'],
 ['0059','hard','Сколькими способами можно выбрать двух человек из десяти, если порядок не важен?','45','','science','10 × 9 / 2.','formula:10*9/2'],
 ['0060','hard','Чему равна сумма внутренних углов выпуклого десятиугольника?','1440','°','science','(n − 2) × 180° при n = 10.','formula:(10-2)*180']
].map(([id,difficulty,question,answer,unit,categories,note,source])=>Object.freeze({
 id:'approx-'+id,question,answer,unit,difficulty,categories:Object.freeze(categories.split(',')),note,
 source:QUIP_APPROX_SOURCES[source]||source,pack:'approx-core-v1'
})));
function getApproxQuestionPool(level){
 if(!PARTY_CARD_LEVELS.includes(level))throw Error('Unknown question difficulty');
 return QUIP_APPROX_QUESTIONS.filter(question=>question.difficulty===level);
}
function settleSharedAward(round,choice){
 const recipients={a:[0],b:[1],both:[0,1],none:[]}[choice];
 if(!recipients)throw Error('Unknown shared award');
 return {recipients:recipients.slice(),deltas:[0,1].map(index=>recipients.includes(index)?round.points:0)};
}
