import type {
  Program, Initiative, Event, Course, Game,
  Opportunity, BlogPost, TeamMember, CareerNode, CarbonQuestion,
  UserProfileResponse, AdminStats, AnalyticItem, ContactMessage
} from "../types";

// ==========================================
// Climatify Platform Mock Datasets
// المحتوى أدناه هو المحتوى الرسمي المعتمد للمنصة (Content.md) بصياغته
// العربية والإنجليزية النهائية — الـ mock نفسه عيّنة جاهزة للدمج مع Flask.
// Mock data isolated for easy backend Flask integration
// ==========================================

export const mockPrograms: Program[] = [
  {
    id: "arab-climate-action-platform",
    titleEn: "Arab Climate Action Platform",
    titleAr: "منصة العمل المناخي العربي",
    descriptionEn: "A regional digital platform that empowers and connects climate initiatives led by Arab youth.",
    descriptionAr: "منصة رقمية إقليمية تهدف إلى تمكين وربط المبادرات المناخية التي يقودها الشباب العربي.",
    icon: "Monitor",
    longDescriptionEn: "The platform addresses the key gaps holding youth initiatives back across the region: weak visibility, limited institutional support, poor cross-border collaboration, and the need to document impactful projects and exchange knowledge. It offers a space to showcase projects, build partnerships, and develop the capacities of youth and civil-society organizations. Status: under development.",
    longDescriptionAr: "تعالج المنصة الفجوات الرئيسية في ضعف ظهور المبادرات الشبابية بالمنطقة، ومحدودية الدعم المؤسسي، وضعف التعاون العابر للحدود، والحاجة إلى توثيق المشاريع المؤثرة وتبادل المعرفة وبناء القدرات. وتوفر مساحة لعرض المشاريع وبناء الشراكات وتطوير قدرات منظمات الشباب والمجتمع المدني. الحالة: قيد التطوير."
  },
  {
    id: "shift-internship",
    titleEn: "SHIFT Internship",
    titleAr: "برنامج SHIFT للتدريب",
    descriptionEn: "A regional internship running four times a year, offering a three-month experience in climate action, water sustainability, and space innovation.",
    descriptionAr: "برنامج إقليمي للتدريب يعمل أربع مرات سنوياً، ويقدم تجربة تمتد لثلاثة أشهر في العمل المناخي واستدامة المياه وابتكار الفضاء.",
    icon: "Users",
    longDescriptionEn: "SHIFT provides hands-on learning, international exposure, and capacity building led by international experts. The program also focuses on leadership, communication, problem-solving, and dealing with real-world challenges.",
    longDescriptionAr: "يوفر البرنامج تعلماً عملياً وتعرضاً دولياً وبناءً للقدرات بقيادة خبراء دوليين. كما يركز على القيادة والتواصل وحل المشكلات والتعامل مع تحديات واقعية."
  },
  {
    id: "wavemakers-camp",
    titleEn: "Wavemakers Summer Students Camp",
    titleAr: "معسكر صنّاع التغيير الصيفي للطلاب",
    descriptionEn: "A summer camp for young people aged 14–18, combining a 7-day field training in Hurghada with a 3-day virtual camp.",
    descriptionAr: "معسكر صيفي يستهدف الشباب من عمر 14 إلى 18 عاماً، يجمع بين تدريب ميداني لمدة 7 أيام في الغردقة ومعسكر افتراضي لمدة 3 أيام.",
    icon: "Activity",
    longDescriptionEn: "Camp topics covered climate change, water sustainability, renewable energy, agriculture, the global water crisis, and climate policy — alongside marine activities, interactive workshops, and mentoring sessions.",
    longDescriptionAr: "تضمن المعسكر مواضيع مثل تغير المناخ واستدامة المياه والطاقة المتجددة والزراعة وأزمة المياه العالمية وسياسات المناخ، إلى جانب أنشطة بحرية وورش تفاعلية وجلسات إرشاد."
  },
  {
    id: "nawah-network",
    titleEn: "Nawah Eco-feminist Network",
    titleAr: "شبكة نواة للعدالة البيئية وتمكين المرأة",
    descriptionEn: "An initiative empowering women in rural and marginalized communities in Egypt to face climate-change challenges.",
    descriptionAr: "مبادرة لتمكين النساء في المجتمعات الريفية والمهمشة في مصر لمواجهة تحديات تغير المناخ.",
    icon: "Leaf",
    longDescriptionEn: "The initiative reached more than 200 participants and empowered over 50 women across Cairo, Alexandria, Assiut, Beni Suef, and Beheira. It included specialized trainings, storytelling workshops with female farmers and fisherwomen, and a national awareness campaign.",
    longDescriptionAr: "وصلت المبادرة إلى أكثر من 200 مشارك ومكّنت أكثر من 50 امرأة عبر محافظات القاهرة والإسكندرية وأسيوط وبني سويف والبحيرة، وشملت تدريبات متخصصة وورش سرد قصصي مع المزارعات والصيادات وحملة توعية وطنية."
  },
  {
    id: "cadrr-fellowship",
    titleEn: "Climate Action & Disaster Risk Reduction Fellowship",
    titleAr: "زمالة العمل المناخي والحد من مخاطر الكوارث",
    descriptionEn: "A 12-week regional fellowship that trains and empowers youth in climate action and disaster preparedness.",
    descriptionAr: "برنامج إقليمي مدته 12 أسبوعاً يهدف إلى تدريب وتمكين الشباب في العمل المناخي والقدرة على مواجهة الكوارث.",
    icon: "TreePine",
    longDescriptionEn: "The fellowship spans four stages: core training, an Innovation Living Lab, a Regional Hackathon, and Seed Funding. It targets 150–200 young leaders, supporting community-driven solutions and high-impact pilot projects.",
    longDescriptionAr: "يتضمن البرنامج أربع مراحل: التدريب الأساسي، وInnovation Living Lab، وهاكاثون إقليمي، وتمويل أولي (Seed Funding). ويستهدف البرنامج 150–200 قائد شاب، مع تطوير حلول مجتمعية ودعم مشاريع تجريبية عالية التأثير."
  },
  {
    id: "green-echo-hackathon",
    titleEn: "Green Echo Hackathon",
    titleAr: "هاكاثون الصدى الأخضر (Green Echo)",
    descriptionEn: "A hackathon focused on food security in the most vulnerable communities across the Middle East and North Africa.",
    descriptionAr: "هاكاثون يركز على الأمن الغذائي في المجتمعات الأكثر عرضة للخطر في منطقة الشرق الأوسط وشمال أفريقيا.",
    icon: "Search",
    longDescriptionEn: "The hackathon received 160 projects in total: 42 projects advanced to the first round, 15 reached the semi-finals, and 3 projects made it to the grand finale.",
    longDescriptionAr: "استقبل الهاكاثون 160 مشروعاً في المجموع: تأهل 42 مشروعاً إلى المرحلة الأولى، ووصل 15 مشروعاً إلى نصف النهائي، وبلغت 3 مشاريع إلى النهائي."
  }
];

// المبادرات مقسّمة بـ `type` على تبويبات صفحة البرامج: الحملات / برامج / معسكرات / ورش عمل.
// المحتوى من البورتفوليو الرسمي (Climatify Portfolio 2025) و Content.md.
// `progress` و `target` للحملات المقاسة فقط — باقي الأنواع بتسيبهم فاضيين والصفحة بتخفيهم.
export const mockInitiatives: Initiative[] = [
  // ── الحملات ──
  {
    id: "cop28-campaign",
    type: "campaign",
    titleEn: "Climatify Paving the Way to COP28",
    titleAr: "حملة تمهيد الطريق نحو COP28",
    descriptionEn: "A youth campaign run in collaboration with Global Shapers Dubai to enrich young people's knowledge of climate and environmental issues. It brought together 160 participants from across the MENA region and highlighted 55 youth voices and 60 youth-led initiatives and organizations.",
    descriptionAr: "حملة شبابية نُفذت بالتعاون مع Global Shapers Dubai لرفع معرفة الشباب بالقضايا المناخية والبيئية. جمعت 160 مشاركاً من منطقة الشرق الأوسط وشمال أفريقيا، وسلطت الضوء على 55 صوتاً شبابياً و60 مبادرة ومنظمة يقودها الشباب.",
    image: "https://climatify-youth.com/wp-content/uploads/2024/01/paving-the-way-to-COP28-Campaign-2048x2048.png",
    categoryEn: "Campaign · 2023",
    categoryAr: "حملة · 2023",
    progress: 100,
    targetEn: "",
    targetAr: "",
    status: "completed",
    participantsCount: 160
  },
  {
    id: "ramadan-akhdar",
    type: "campaign",
    titleEn: "Ramadan Akhdar",
    titleAr: "رمضان أخضر",
    descriptionEn: "An 8-episode series of Arabic audio messages that raises environmental awareness during Ramadan. Topics include the green economy, green entrepreneurship, sustainable consumption, healthy habits, eco-feminism, and green technology.",
    descriptionAr: "سلسلة من 8 حلقات صوتية باللغة العربية لنشر الوعي البيئي خلال شهر رمضان، تتناول الاقتصاد الأخضر وريادة الأعمال الخضراء والاستهلاك المستدام والعادات الصحية والنسوية البيئية والتكنولوجيا الخضراء.",
    image: "",
    categoryEn: "Campaign",
    categoryAr: "حملة",
    progress: 100,
    targetEn: "",
    targetAr: "",
    status: "completed"
  },

  // ── برامج ──
  {
    id: "university-clubs",
    type: "program",
    titleEn: "Climatify University Clubs",
    titleAr: "أندية كلايمتيفاي الجامعية",
    descriptionEn: "Clubs that empower university students to engage in climate action — a platform to exchange ideas, gain skills, and implement innovative projects that offer sustainable solutions to environmental challenges.",
    descriptionAr: "أندية تمكّن طلاب الجامعات من المشاركة في العمل المناخي، وتوفر لهم منصة لتبادل الأفكار واكتساب المهارات وتنفيذ مشاريع مبتكرة تقدم حلولاً مستدامة للتحديات البيئية.",
    image: "",
    categoryEn: "Youth & Women Empowerment",
    categoryAr: "تمكين الشباب والمرأة",
    progress: 0,
    targetEn: "",
    targetAr: ""
  },
  {
    id: "eywan",
    type: "program",
    titleEn: "Emirates Young Women Agricultural Network (EYWAN)",
    titleAr: "شبكة الشابات الإماراتيات الزراعية (EYWAN)",
    descriptionEn: "An initiative that empowers young Emirati women to spearhead sustainable agricultural development. The first of its kind locally, it is aligned with national agendas for food and water security and offers education, training, and opportunities to aspiring young women in agriculture.",
    descriptionAr: "مبادرة لتمكين الشابات الإماراتيات من قيادة التنمية الزراعية المستدامة. هي الأولى من نوعها محلياً، وتتوافق مع الأجندات الوطنية للأمن الغذائي والمائي، وتقدم التعليم والتدريب والفرص للشابات الطموحات في مجال الزراعة.",
    image: "",
    categoryEn: "Youth & Women Empowerment",
    categoryAr: "تمكين الشباب والمرأة",
    progress: 0,
    targetEn: "",
    targetAr: ""
  },

  // ── معسكرات ──
  {
    id: "wavemakers-summer-camp",
    type: "camp",
    titleEn: "Wavemakers Summer Students Camp",
    titleAr: "معسكر صنّاع التغيير الصيفي للطلاب",
    descriptionEn: "A summer camp for young people aged 14–18 that combines a 7-day field training in Hurghada with a 3-day virtual camp, covering climate change, water sustainability, renewable energy, agriculture, and climate policy.",
    descriptionAr: "معسكر صيفي للشباب من عمر 14 إلى 18 عاماً يجمع بين تدريب ميداني لمدة 7 أيام في الغردقة ومعسكر افتراضي لمدة 3 أيام، ويغطي تغير المناخ واستدامة المياه والطاقة المتجددة والزراعة وسياسات المناخ.",
    image: "",
    categoryEn: "Camp · August 2024",
    categoryAr: "معسكر · أغسطس 2024",
    progress: 0,
    targetEn: "",
    targetAr: "",
    startDate: "2024-08-01"
  },
  {
    id: "transforming-narratives-camp",
    type: "camp",
    titleEn: "Transforming Narratives on Climate Action",
    titleAr: "تحويل السرديات حول العمل المناخي",
    descriptionEn: "A Climatify camp held in May 2025.",
    descriptionAr: "معسكر نظمته كلايمتيفاي في مايو 2025.",
    image: "",
    categoryEn: "Camp · May 2025",
    categoryAr: "معسكر · مايو 2025",
    progress: 0,
    targetEn: "",
    targetAr: "",
    startDate: "2025-05-01"
  },

  // ── ورش عمل ──
  {
    id: "our-workshops",
    type: "workshop",
    titleEn: "Our Workshops",
    titleAr: "ورش كلايمتيفاي",
    descriptionEn: "Scan the QR code to open the Climatify workshops proposal and browse all the workshops we offer.",
    descriptionAr: "امسح رمز QR لفتح ملف ورش كلايمتيفاي واستعراض كل الورش التي نقدمها.",
    image: "",
    qrImage: "/workshops/workshops-proposal-qr.png",
    categoryEn: "All Workshops",
    categoryAr: "كل الورش",
    progress: 0,
    targetEn: "",
    targetAr: ""
  },
  {
    id: "workshop-hands-on-farming",
    type: "workshop",
    titleEn: "Hands-on Workshop: Farming & Agricultural Waste Recycling",
    titleAr: "ورشة تطبيقية: الزراعة وإعادة تدوير المخلفات الزراعية",
    descriptionEn: "A hands-on workshop in Egypt on sustainable farming and agricultural waste recycling. 45 students explored composting techniques and circular-economy solutions that turn waste into valuable resources.",
    descriptionAr: "ورشة تطبيقية في مصر حول الزراعة المستدامة وإعادة تدوير المخلفات الزراعية، تعرّف فيها 45 طالباً على تقنيات التسميد وحلول الاقتصاد الدائري لتحويل المخلفات إلى موارد نافعة.",
    image: "",
    categoryEn: "Workshop · February 2025",
    categoryAr: "ورشة عمل · فبراير 2025",
    progress: 0,
    targetEn: "",
    targetAr: "",
    participantsCount: 45,
    startDate: "2025-02-01"
  },
  {
    id: "workshop-little-green-heroes",
    type: "workshop",
    titleEn: "Little Green Heroes: Waste Management Fun",
    titleAr: "أبطال البيئة الصغار: متعة إدارة النفايات",
    descriptionEn: "A workshop delivered at the Future Heroes Summer Camp hosted by the Museum of the Future. More than 50 students learned about waste segregation, the 3Rs (Reduce, Reuse, Recycle), e-waste handling, and waste-to-energy through interactive activities.",
    descriptionAr: "ورشة قُدمت ضمن معسكر Future Heroes الصيفي الذي استضافه متحف المستقبل. تعلّم فيها أكثر من 50 طالباً فرز النفايات ومبادئ التقليل وإعادة الاستخدام وإعادة التدوير والتعامل مع النفايات الإلكترونية وتحويل النفايات إلى طاقة عبر أنشطة تفاعلية.",
    image: "",
    categoryEn: "Workshop",
    categoryAr: "ورشة عمل",
    progress: 0,
    targetEn: "",
    targetAr: "",
    participantsCount: 50
  },
  {
    id: "workshop-uaeu-self-watering-trash-to-art",
    type: "workshop",
    titleEn: "Self-Watering Planting & Trash to Art",
    titleAr: "الزراعة ذاتية الري وتحويل المخلفات إلى فن",
    descriptionEn: "Two interactive workshops delivered over two days at the Sustainable Universe Conference 2025 at the United Arab Emirates University, combining creativity, environmental education, and hands-on learning.",
    descriptionAr: "ورشتان تفاعليتان قُدمتا على مدار يومين ضمن مؤتمر الكون المستدام 2025 في جامعة الإمارات العربية المتحدة، تجمعان بين الإبداع والتعليم البيئي والتعلم التطبيقي.",
    image: "",
    categoryEn: "Workshop · October 2025",
    categoryAr: "ورشة عمل · أكتوبر 2025",
    progress: 0,
    targetEn: "",
    targetAr: "",
    startDate: "2025-10-01"
  }
];

// ملاحظة تواريخ: الفعاليات المعروفة بالشهر فقط سُجّلت بأول ذلك الشهر، والفعاليات
// التي لا يذكر المحتوى تاريخها تُرسَل بدون تاريخ — الصفحة تعرضها "غير محدد"
// وتعطّل التسجيل عليها بدل اختلاق تاريخ غير صحيح.
export const mockEvents: Event[] = [
  // التاريخ والمكان مش مذكورين في المصادر المتاحة — بيتسابوا فاضيين بدل التخمين.
  {
    id: "sustainability-week-2026",
    titleEn: "Sustainability Week 2026 — Climatify × Heliopolis University",
    titleAr: "أسبوع الاستدامة 2026 — كلايمتيفاي × جامعة هليوبوليس",
    descriptionEn: "Sustainability Week 2026, organized by Climatify in collaboration with Heliopolis University.",
    descriptionAr: "أسبوع الاستدامة 2026، بتنظيم كلايمتيفاي بالتعاون مع جامعة هليوبوليس.",
    date: "",
    locationEn: "",
    locationAr: "",
    categoryEn: "Conference",
    categoryAr: "مؤتمرات",
    registeredCount: 0
  },
  {
    id: "heliopolis-university-mou-2026",
    titleEn: "Climatify & Heliopolis University for Sustainable Development",
    titleAr: "كلايمتيفاي وجامعة هليوبوليس للتنمية المستدامة",
    descriptionEn: "Climatify signed an MoU with Heliopolis University for Sustainable Development to drive youth empowerment, capacity building, and climate action — bridging academic knowledge with real-world applications.",
    descriptionAr: "وقّعت كلايمتيفاي مذكرة تفاهم مع جامعة هليوبوليس للتنمية المستدامة لدعم تمكين الشباب وبناء القدرات والعمل المناخي، وربط المعرفة الأكاديمية بالتطبيق العملي.",
    date: "2026-09-01",
    locationEn: "Heliopolis University, Egypt",
    locationAr: "جامعة هليوبوليس، مصر",
    categoryEn: "Conference",
    categoryAr: "مؤتمرات",
    registeredCount: 0
  },
  {
    id: "shift-first-cohort-graduation",
    titleEn: "SHIFT — First Cohort Graduation",
    titleAr: "تخرج الدفعة الأولى من برنامج SHIFT",
    descriptionEn: "The graduation ceremony of the first SHIFT cohort, featuring keynote sessions, success stories, interactive workshops, and an AgriClash experience.",
    descriptionAr: "حفل تخرج أول دفعة من برنامج SHIFT، تضمن جلسات رئيسية وقصص نجاح وورشاً تفاعلية وتجربة AgriClash.",
    date: "2026-02-01",
    locationEn: "United Arab Emirates",
    locationAr: "الإمارات العربية المتحدة",
    categoryEn: "Conference",
    categoryAr: "مؤتمرات",
    registeredCount: 0
  },
  {
    id: "sustainable-universe-conference-2025",
    titleEn: "Sustainable Universe Conference 2025",
    titleAr: "مؤتمر الكون المستدام 2025 (Sustainable Universe)",
    descriptionEn: "Interactive workshops on self-watering agriculture, turning waste into art, sustainability, and environmental education.",
    descriptionAr: "ورش تفاعلية حول الزراعة ذاتية الري وتحويل المخلفات إلى فن والاستدامة والتعليم البيئي.",
    date: "2025-10-01",
    locationEn: "United Arab Emirates University, Al Ain",
    locationAr: "جامعة الإمارات العربية المتحدة، العين",
    categoryEn: "Conference",
    categoryAr: "مؤتمرات",
    registeredCount: 0
  },
  {
    id: "forbes-me-sustainability-summit-2025",
    titleEn: "Forbes Middle East Sustainability Leaders Summit 2025",
    titleAr: "قمة قادة الاستدامة — فوربس الشرق الأوسط 2025",
    descriptionEn: "Participation in a panel session on youth-led startups and their role in building a sustainable future.",
    descriptionAr: "المشاركة في جلسة حول الشركات الناشئة التي يقودها الشباب ودورها في بناء مستقبل مستدام.",
    date: "2025-10-01",
    locationEn: "",
    locationAr: "",
    categoryEn: "Conference",
    categoryAr: "مؤتمرات",
    registeredCount: 0
  },
  {
    id: "world-utilities-youth-energy-forum-2025",
    titleEn: "World Utilities Congress — Youth Energy Forum",
    titleAr: "الكونغرس العالمي للمرافق — منتدى طاقة الشباب",
    descriptionEn: "Participation in discussions on the energy transition, decarbonization, and sustainable solutions led by youth.",
    descriptionAr: "مشاركة في نقاشات حول انتقال الطاقة وإزالة الكربون والحلول المستدامة التي يقودها الشباب.",
    date: "2025-05-01",
    locationEn: "Abu Dhabi, UAE",
    locationAr: "أبوظبي، الإمارات",
    categoryEn: "Conference",
    categoryAr: "مؤتمرات",
    registeredCount: 0
  },
  {
    id: "earth-day-event",
    titleEn: "Earth Day Event",
    titleAr: "فعالية يوم الأرض",
    descriptionEn: "An event that brought together environment and climate activists to strengthen collaboration and shared environmental responsibility.",
    descriptionAr: "فعالية جمعت نشطاء في مجال البيئة والمناخ لتعزيز التعاون والمسؤولية البيئية المشتركة.",
    date: "2025-04-22",
    locationEn: "",
    locationAr: "",
    categoryEn: "Outreach",
    categoryAr: "توعية ومشاركات",
    registeredCount: 0
  },
  {
    id: "farming-agri-waste-workshop-2025",
    titleEn: "Farming & Agricultural Waste Recycling Workshop",
    titleAr: "ورشة الزراعة وإعادة تدوير المخلفات الزراعية",
    descriptionEn: "A workshop on sustainable agriculture and agricultural-waste recycling with the participation of 45 students.",
    descriptionAr: "ورشة حول الزراعة المستدامة وإعادة تدوير المخلفات الزراعية بمشاركة 45 طالباً.",
    date: "2025-02-01",
    locationEn: "Egypt",
    locationAr: "مصر",
    categoryEn: "Workshop",
    categoryAr: "ورش عمل",
    registeredCount: 0
  },
  {
    id: "cop29-azerbaijan",
    titleEn: "COP29 — Azerbaijan",
    titleAr: "قمة المناخ COP29 — أذربيجان",
    descriptionEn: "Participation in a session on the role of UAE youth in tackling climate change, agricultural innovation, and supporting climate-affected communities.",
    descriptionAr: "مشاركة في جلسة حول دور شباب الإمارات في مواجهة تغير المناخ والابتكار الزراعي ودعم المجتمعات المتأثرة بالمناخ.",
    date: "2024-11-01",
    locationEn: "Baku, Azerbaijan",
    locationAr: "باكو، أذربيجان",
    categoryEn: "Conference",
    categoryAr: "مؤتمرات",
    registeredCount: 0
  },
  {
    id: "rise-25-aus",
    titleEn: "RISE '25",
    titleAr: "فعالية RISE '25",
    descriptionEn: "An event at the American University of Sharjah to engage with students and change-makers interested in climate innovation and sustainability.",
    descriptionAr: "فعالية في الجامعة الأمريكية في الشارقة للتفاعل مع الطلاب وصناع التغيير المهتمين بالابتكار المناخي والاستدامة.",
    date: "",
    locationEn: "American University of Sharjah",
    locationAr: "الجامعة الأمريكية في الشارقة",
    categoryEn: "Outreach",
    categoryAr: "توعية ومشاركات",
    registeredCount: 0
  },
  {
    id: "future-pioneers-award",
    titleEn: "Future Pioneers Award",
    titleAr: "جائزة رواد المستقبل",
    descriptionEn: "Climatify's participation in the Future Pioneers Award by BEEAH Group, which celebrated youth innovation and leadership in sustainability.",
    descriptionAr: "مشاركة كلايمتيفاي في جائزة Future Pioneers Award التابعة لمجموعة بيئة (BEEAH Group)، التي احتفت بالابتكار والقيادة الشبابية في الاستدامة.",
    date: "",
    locationEn: "United Arab Emirates",
    locationAr: "الإمارات العربية المتحدة",
    categoryEn: "Award",
    categoryAr: "جوائز وتكريم",
    registeredCount: 0
  },
  {
    id: "rcoy-mena-2024",
    titleEn: "RCOY MENA 2024",
    titleAr: "المؤتمر الإقليمي للشباب RCOY — الشرق الأوسط وشمال أفريقيا 2024",
    descriptionEn: "A strategic partnership supporting a regional conference that gathered 250+ youth from the Arab world, with support for 10 youth-led emerging projects.",
    descriptionAr: "شراكة استراتيجية لدعم مؤتمر إقليمي جمع أكثر من 250 شاباً من العالم العربي، مع دعم 10 مشاريع ناشئة يقودها الشباب.",
    date: "",
    locationEn: "MENA Region",
    locationAr: "منطقة الشرق الأوسط وشمال أفريقيا",
    categoryEn: "Conference",
    categoryAr: "مؤتمرات",
    registeredCount: 0
  }
];

// قسم التعلم Hub: 5 ورش عمل + 3 برامج تعليمية (SHIFT / Wavemakers / الزمالة)
// كما وردت في المحتوى الرسمي. عدد الدروس يشير للوحدات التدريبية المتاحة.
export const mockCourses: Course[] = [
  {
    id: "workshop-little-green-heroes",
    titleEn: "Little Green Heroes: Waste Management Fun",
    titleAr: "أبطال الخضر الصغار: متعة إدارة النفايات",
    descriptionEn: "A playful workshop that introduces children to waste sorting, recycling habits, and everyday environmental responsibility.",
    descriptionAr: "ورشة ممتعة تُعرّف الأطفال بفرز النفايات وعادات إعادة التدوير والمسؤولية البيئية في حياتهم اليومية.",
    instructorEn: "Climatify Academy",
    instructorAr: "أكاديمية كلايمتيفاي",
    durationEn: "One interactive session",
    durationAr: "جلسة تفاعلية واحدة",
    lessonsCount: 1,
    categoryEn: "Workshops",
    categoryAr: "ورش عمل",
    image: "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "workshop-self-watering-agriculture",
    titleEn: "Self-Watering Agriculture",
    titleAr: "الزراعة ذاتية الري",
    descriptionEn: "A hands-on workshop on building self-watering planting systems and water-wise farming techniques.",
    descriptionAr: "ورشة تطبيقية حول بناء أنظمة زراعة ذاتية الري وتقنيات الزراعة المقتصدة للمياه.",
    instructorEn: "Climatify Academy",
    instructorAr: "أكاديمية كلايمتيفاي",
    durationEn: "One hands-on session",
    durationAr: "جلسة تطبيقية واحدة",
    lessonsCount: 1,
    categoryEn: "Workshops",
    categoryAr: "ورش عمل",
    image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "workshop-trash-to-art",
    titleEn: "Trash to Art",
    titleAr: "من المخلفات إلى الفن",
    descriptionEn: "A creative workshop that turns everyday waste into art, reshaping how young people see consumption and reuse.",
    descriptionAr: "ورشة إبداعية تحوّل المخلفات اليومية إلى أعمال فنية، وتعيد صياغة نظرية الشباب للاستهلاك وإعادة الاستخدام.",
    instructorEn: "Climatify Academy",
    instructorAr: "أكاديمية كلايمتيفاي",
    durationEn: "One creative session",
    durationAr: "جلسة إبداعية واحدة",
    lessonsCount: 1,
    categoryEn: "Workshops",
    categoryAr: "ورش عمل",
    image: "https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "workshop-climate-fresk",
    titleEn: "Climate Fresk",
    titleAr: "ورشة كلايمت فريسك (Climate Fresk)",
    descriptionEn: "The world-famous collaborative card workshop that helps participants understand the causes and consequences of climate change.",
    descriptionAr: "ورشة تفاعلية عالمية قائمة على اللعب بالبطاقات، تساعد المشاركين على فهم أسباب تغير المناخ ونتائجه.",
    instructorEn: "Climatify Academy",
    instructorAr: "أكاديمية كلايمتيفاي",
    durationEn: "One collaborative session",
    durationAr: "جلسة تعاونية واحدة",
    lessonsCount: 1,
    categoryEn: "Workshops",
    categoryAr: "ورش عمل",
    image: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "workshop-agri-waste-recycling",
    titleEn: "Farming & Agricultural Waste Recycling",
    titleAr: "الزراعة وإعادة تدوير المخلفات الزراعية",
    descriptionEn: "A field workshop on sustainable agriculture and turning agricultural waste into useful resources, delivered with students and local communities.",
    descriptionAr: "ورشة ميدانية حول الزراعة المستدامة وتحويل المخلفات الزراعية إلى موارد مفيدة، تُقدَّم للطلاب والمجتمعات المحلية.",
    instructorEn: "Climatify Academy",
    instructorAr: "أكاديمية كلايمتيفاي",
    durationEn: "One field session",
    durationAr: "جلسة ميدانية واحدة",
    lessonsCount: 1,
    categoryEn: "Workshops",
    categoryAr: "ورش عمل",
    image: "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "course-shift-internship",
    titleEn: "SHIFT Internship",
    titleAr: "برنامج SHIFT للتدريب",
    descriptionEn: "A three-month regional internship running four times a year, covering climate action, water sustainability, and space innovation with international experts.",
    descriptionAr: "تدريب إقليمي لمدة ثلاثة أشهر يعمل أربع مرات سنوياً، يغطي العمل المناخي واستدامة المياه وابتكار الفضاء بقيادة خبراء دوليين.",
    instructorEn: "International Experts",
    instructorAr: "خبراء دوليون",
    durationEn: "3 months · 4 cohorts/year",
    durationAr: "3 أشهر · 4 دفعات سنوياً",
    lessonsCount: 4,
    categoryEn: "Educational Programs",
    categoryAr: "برامج تعليمية",
    image: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "course-wavemakers-camp",
    titleEn: "Wavemakers Summer Students Camp",
    titleAr: "معسكر Wavemakers الصيفي للطلاب",
    descriptionEn: "A summer camp for ages 14–18: seven days of field training in Hurghada plus a three-day virtual camp on climate, water, and energy topics.",
    descriptionAr: "معسكر صيفي للفئة 14–18 عاماً: سبعة أيام تدريب ميداني في الغردقة ومعسكر افتراضي لثلاثة أيام حول المناخ والمياه والطاقة.",
    instructorEn: "Climatify Team",
    instructorAr: "فريق كلايمتيفاي",
    durationEn: "10 days (7 field + 3 virtual)",
    durationAr: "10 أيام (7 ميداني + 3 افتراضي)",
    lessonsCount: 5,
    categoryEn: "Educational Programs",
    categoryAr: "برامج تعليمية",
    image: "https://images.unsplash.com/photo-1502680390469-be75c86b636f?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "course-cadrr-fellowship",
    titleEn: "Climate Action & Disaster Risk Reduction Fellowship",
    titleAr: "زمالة العمل المناخي والحد من مخاطر الكوارث",
    descriptionEn: "A 12-week regional fellowship in four stages: core training, an Innovation Living Lab, a Regional Hackathon, and Seed Funding for 150–200 young leaders.",
    descriptionAr: "زمالة إقليمية لمدة 12 أسبوعاً بأربع مراحل: التدريب الأساسي، وInnovation Living Lab، وهاكاثون إقليمي، وتمويل أولي — لـ150–200 قائد شاب.",
    instructorEn: "Climatify Academy",
    instructorAr: "أكاديمية كلايمتيفاي",
    durationEn: "12 weeks · 4 stages",
    durationAr: "12 أسبوعاً · 4 مراحل",
    lessonsCount: 4,
    categoryEn: "Educational Programs",
    categoryAr: "برامج تعليمية",
    image: "https://images.unsplash.com/photo-1544531586-fde5298cdd40?auto=format&fit=crop&w=800&q=80"
  }
];

// ألعاب المناخ: AgriClash و GreenSharks. لكل لعبة `videoUrl` اختياري بيتفتح في Popup
// (YouTube / Google Drive / ملف mp4). لسه مفيش فيديو لأي لعبة.
// TODO(content): وصف GreenSharks لسه مش متاح — الكارت بيعرض الاسم بس لحد ما يتبعت.
export const mockGames: Game[] = [
  {
    id: "agriclash",
    titleEn: "AgriClash",
    titleAr: "AgriClash",
    descriptionEn: "An interactive educational game developed by Climatify under the SHIFT program. Players split into Policy Makers and Engineers teams, cooperating and competing to manage agricultural resources and tackle climate challenges.",
    descriptionAr: "لعبة تعليمية تفاعلية طوّرتها كلايمتيفاي ضمن مخرجات برنامج SHIFT. ينقسم اللاعبون إلى فريقين — صنّاع القرار والمهندسون — ويتعاونون ويتنافسون في إدارة الموارد الزراعية ومواجهة تحديات المناخ.",
    categoryEn: "Team Game",
    categoryAr: "لعبة جماعية",
    icon: "Sprout",
    playUrl: ""
  },
  {
    id: "greensharks",
    titleEn: "GreenSharks",
    titleAr: "GreenSharks",
    descriptionEn: "",
    descriptionAr: "",
    categoryEn: "Game",
    categoryAr: "لعبة",
    icon: "Gamepad2",
    playUrl: ""
  }
];

export const mockOpportunities: Opportunity[] = [
  {
    id: "vol-dubai-outreach",
    titleEn: "Community Outreach Volunteer",
    titleAr: "متطوع في التوعية الجماهيرية",
    descriptionEn: "Help us organize climate literacy workshops in schools across Dubai.",
    descriptionAr: "ساعدنا في تنظيم ورش عمل التوعية بالمناخ في المدارس بمختلف أنحاء دبي.",
    typeEn: "Volunteering",
    typeAr: "تطوع",
    locationEn: "Dubai",
    locationAr: "دبي",
    postedDate: "2026-07-15"
  },
  {
    id: "intern-data-analyst",
    titleEn: "Climate Data Analyst Intern",
    titleAr: "متدرب في تحليل البيانات المناخية",
    descriptionEn: "Analyze local environmental data sets to support our annual reporting team.",
    descriptionAr: "تحليل مجموعات البيانات البيئية المحلية لدعم فريق إعداد التقارير السنوية.",
    typeEn: "Internship",
    typeAr: "تدريب عملي",
    locationEn: "Abu Dhabi",
    locationAr: "أبوظبي",
    postedDate: "2026-07-10"
  }
];

export const mockBlogPosts: BlogPost[] = [
  {
    id: "ramadan-akhdar-campaign",
    titleEn: "Ramadan Akhdar Audio Campaign",
    titleAr: "حملة «رمضان أخضر» الصوتية",
    excerptEn: "A series of 8 Arabic audio episodes exploring the green economy, green entrepreneurship, sustainable consumption, and eco-conscious lifestyles.",
    excerptAr: "سلسلة من 8 رسائل صوتية عربية حول الاقتصاد الأخضر وريادة الأعمال الخضراء والاستهلاك المستدام والعادات الصحية.",
    contentEn: "Ramadan Akhdar is a series of eight Arabic audio messages produced by Climatify. The episodes cover the green economy, green entrepreneurship, sustainable consumption, healthy habits, eco-feminism, and green technology — bringing climate literacy into everyday Ramadan conversations in a simple, accessible format.",
    contentAr: "«رمضان أخضر» سلسلة من ثماني رسائل صوتية عربية من إنتاج كلايمتيفاي. تتناول الحلقات الاقتصاد الأخضر وريادة الأعمال الخضراء والاستهلاك المستدام والعادات الصحية والنسوية البيئية والتكنولوجيا الخضراء — لتقرّب الثقافة المناخية من حوارات رمضان اليومية بصيغة بسيطة ومتاحة للجميع.",
    image: "https://images.unsplash.com/photo-1542816417-0983c9c9ad53?auto=format&fit=crop&w=800&q=80",
    date: "2024-03-11",
    authorEn: "Climatify Admin",
    authorAr: "مسؤول كلايمتيفاي",
    categoryEn: "Campaigns",
    categoryAr: "حملات"
  },
  {
    id: "paving-way-to-cop28",
    titleEn: "Climatify Paving the Way to COP28",
    titleAr: "حملة كلايمتيفاي لتمهيد الطريق إلى COP28",
    excerptEn: "A campaign to build youth knowledge of climate and environmental issues, in cooperation with Global Shapers Dubai, with participants from several Arab countries.",
    excerptAr: "حملة لرفع معرفة الشباب بالقضايا المناخية والبيئية بالتعاون مع Global Shapers Dubai، وشارك فيها شباب من عدة دول عربية.",
    contentEn: "Climatify Paving the Way to COP28 was a campaign dedicated to raising young people's knowledge of climate and environmental issues ahead of the UN Climate Conference in Dubai. It was organized in cooperation with Global Shapers Dubai and brought together youth from several Arab countries, preparing a generation ready to engage with the global climate agenda.",
    contentAr: "حملة «كلايمتيفاي لتمهيد الطريق إلى COP28» حملة مخصصة لرفع معرفة الشباب بالقضايا المناخية والبيئية استعداداً لمؤتمر الأمم المتحدة للمناخ في دبي. نُظمت بالتعاون مع Global Shapers Dubai، وشارك فيها شباب من عدة دول عربية، بهدف إعداد جيل جاهز للتفاعل مع أجندة المناخ العالمية.",
    image: "https://climatify-youth.com/wp-content/uploads/2024/01/paving-the-way-to-COP28-Campaign-2048x2048.png",
    date: "2023-11-01",
    authorEn: "Climatify Admin",
    authorAr: "مسؤول كلايمتيفاي",
    categoryEn: "Campaigns",
    categoryAr: "حملات"
  },
  {
    id: "progress-report-2023",
    titleEn: "Climatify Progress Report is Now Available",
    titleAr: "تقرير تقدم كلايمتيفاي أصبح متاحاً الآن",
    excerptEn: "We are thrilled to announce that the much-anticipated progress report for the year 2023 is now available!",
    excerptAr: "يسعدنا أن نعلن أن تقرير التقدم المنتظر بشدة لعام 2023 متاح الآن للقراءة والاطلاع!",
    contentEn: "We invite you to explore the detailed analysis of our performance, growth, and the positive contributions we have made to our mission and values. The progress report serves as a testament to the collective efforts of our dedicated team, partners, and stakeholders who have played a pivotal role in our success. It details our key milestones, engagement stats across the UAE, and our digital tool expansions.",
    contentAr: "ندعوكم لاستكشاف التحليل المفصل لأدائنا، ونمونا، والمساهمات الإيجابية التي قدمناها لرسالتنا وقيمنا. يعتبر تقرير التقدم هذا شهادة على الجهود الجماعية لفريقنا المخصص وشركائنا وأصحاب المصلحة الذين لعبوا دوراً محورياً في نجاحنا. ويوضح التقرير أبرز الإنجازات وإحصائيات المشاركة في الإمارات.",
    image: "https://climatify-youth.com/wp-content/uploads/2024/01/Black-and-White-Bold-Type-Social-Media-Report-Report-10.png",
    date: "2024-01-08",
    authorEn: "Climatify Admin",
    authorAr: "مسؤول كلايمتيفاي",
    categoryEn: "Reports",
    categoryAr: "التقارير"
  },
  {
    id: "youth-network-newsletter",
    titleEn: "Climatify Participation in the Youth Climate Action Network Newsletter",
    titleAr: "مشاركتنا في النشرة الإخبارية لشبكة العمل المناخي للشباب",
    excerptEn: "Highlighting our contributions in 2023 in the Fourth Edition of the Arab Youth Council Newsletter.",
    excerptAr: "تسليط الضوء على إنجازاتنا ومشاركاتنا لعام 2023 في العدد الرابع لنشرة مجلس الشباب العربي المناخي.",
    contentEn: "We are delighted to share our participation in the newsletter of the Arab Youth Council Network for Climate Action, which highlighted our contributions in 2023. Our campaigns aimed at empowering knowledgeable youth, fostering exchange of experiences, and shedding light on the voices of young people, showcasing their efforts in climate and community work. Grateful for this opportunity, our call extends from youth to youth, emanating from our team dedicated to unifying youth efforts.",
    contentAr: "يسعدنا مشاركة مساهماتنا في النشرة الإخبارية لشبكة مجلس الشباب العربي للعمل المناخي، والتي سلطت الضوء على جهودنا لعام 2023. هدفت حملاتنا لتمكين الشباب المعرفي، وتبادل الخبرات، وتسليط الضوء على أصوات الشباب وجهودهم الملموسة في العمل المناخي والخدمة المجتمعية.",
    image: "https://climatify-youth.com/wp-content/uploads/2024/01/Yellow-Dynamic-Moving-House-Announcement.png",
    date: "2024-01-30",
    authorEn: "Climatify Admin",
    authorAr: "مسؤول كلايمتيفاي",
    categoryEn: "Events & Media",
    categoryAr: "الفعاليات والإعلام"
  },
  {
    id: "khalifa-univ-safety-day",
    titleEn: "Participation at Khalifa University's Environmental Health and Safety Day",
    titleAr: "مشاركتنا في يوم البيئة والصحة والسلامة بجامعة خليفة",
    excerptEn: "Climatify was honored to engage with students and faculty discussing sustainability at Khalifa University.",
    excerptAr: "تشرفت كلايمتيفاي بالمشاركة والتفاعل مع الطلاب وأعضاء التدريس حول الاستدامة بجامعة خليفة.",
    contentEn: "Climatify was honored to participate in Khalifa University’s Environmental Health and Safety Day on April 25th! We had an amazing time engaging with students and faculty, discussing our commitment to sustainability and promoting environmental awareness. Our team shared insights on how technology can drive positive change for our planet, emphasizing the importance of innovative solutions. Special thanks to Ms. Amna Alsuwaidi and Khalifa University!",
    contentAr: "تشرفت كلايمتيفاي بالمشاركة في يوم البيئة والصحة والسلامة بجامعة خليفة في 25 أبريل! قضينا وقتاً رائعاً في التفاعل مع الطلاب والأساتذة ومناقشة التزامنا بالاستدامة ونشر الوعي البيئي. شارك فريقنا رؤى حول كيف تساهم التكنولوجيا في إحداث تغيير إيجابي لكوكبنا. كل الشكر للأستاذة آمنة السويدي وجامعة خليفة العريقة!",
    image: "https://climatify-youth.com/wp-content/uploads/2024/05/1714473909094.jpg",
    date: "2024-05-05",
    authorEn: "Climatify Admin",
    authorAr: "مسؤول كلايمتيفاي",
    categoryEn: "Blog",
    categoryAr: "المدونة"
  }
];

export const mockTeam: TeamMember[] = [
  {
    id: "mai-mowad",
    nameEn: "Mai Mowad",
    nameAr: "مي معوض",
    roleEn: "Founder & Managing Director",
    roleAr: "المؤسس والمدير الإداري",
    image: "/founders/Mai Mowad_1.png",
    group: "founder",
    borderColor: "#10B981",
    gradient: "linear-gradient(145deg, #059669, #022c22)"
  },
  {
    id: "abdullah-salmani",
    nameEn: "Abdullah Al Salmani",
    nameAr: "عبد الله السلماني",
    roleEn: "Co-Founder & Tech Director",
    roleAr: "المؤسس المشارك والمدير التقني",
    image: "/founders/Abdullah Al Salmani_2.png",
    group: "founder",
    borderColor: "#38BDF8",
    gradient: "linear-gradient(145deg, #0284c7, #082f49)"
  },
  {
    id: "marwa-shalwani",
    nameEn: "Marwa Al Shalwani",
    nameAr: "مروة الشلواتي",
    roleEn: "Community Director",
    roleAr: "مديرة العلاقات المجتمعية",
    image: "/founders/Marwa Al Shalwani_3.png",
    group: "founder",
    borderColor: "#A78BFA",
    gradient: "linear-gradient(145deg, #7c3aed, #2e1065)"
  },
  {
    id: "leena-elneel",
    nameEn: "Leena Elneel",
    nameAr: "لينا النيل",
    roleEn: "Research & Policy Lead",
    roleAr: "رئيسة الأبحاث والسياسات",
    image: "/founders/Leena Elneel_4.png",
    group: "founder",
    borderColor: "#FBBF24",
    gradient: "linear-gradient(145deg, #d97706, #451a03)"
  },
  {
    id: "hend-mehri",
    nameEn: "Hend Al Mehri",
    nameAr: "هند المهيري",
    roleEn: "Outreach Coordinator",
    roleAr: "منسقة التوعية الجماهيرية",
    image: "/founders/Hend Al Mehri_5.png",
    group: "founder",
    borderColor: "#2DD4BF",
    gradient: "linear-gradient(145deg, #0d9488, #042f2e)"
  },
  {
    id: "sheikha-sherif",
    nameEn: "Sheikha Sherif",
    nameAr: "شيخة شريف",
    roleEn: "Operations Lead",
    roleAr: "رئيسة العمليات",
    image: "/founders/Sheikha Sherif_6.png",
    group: "founder",
    borderColor: "#60A5FA",
    gradient: "linear-gradient(145deg, #2563eb, #172554)"
  },
  {
    id: "sheikha-shafar",
    nameEn: "Sheikha Al Shafar",
    nameAr: "شيخة الشفار",
    roleEn: "Creative Director",
    roleAr: "المديرة الإبداعية",
    image: "/founders/Sheikha Al Shafar_7.png",
    group: "founder",
    borderColor: "#F472B6",
    gradient: "linear-gradient(145deg, #db2777, #500724)"
  },
  {
    id: "heba-momtaz",
    nameEn: "Heba Momtaz",
    nameAr: "هبة ممتاز",
    roleEn: "Project Manager",
    roleAr: "مديرة المشاريع",
    image: "/founders/Heba Momtaz_8.png",
    group: "founder",
    borderColor: "#A3E635",
    gradient: "linear-gradient(145deg, #65a30d, #1a2e05)"
  },
  {
    id: "yathreb-mahmoud",
    nameEn: "Yathreb Mahmoud",
    nameAr: "يثرب محمود",
    roleEn: "Founder & Executive Director",
    roleAr: "المؤسسة والمديرة التنفيذية",
    image: "/founders/Yathreb Mahmoud_9.png",
    group: "founder",
    borderColor: "#818CF8",
    gradient: "linear-gradient(145deg, #4f46e5, #1e1b4b)"
  },

  // ── فريق العمل (Core Team) — لسه من غير صور، الكارت بيعرض الحروف الأولى ──
  {
    id: "ahmed-ashraf-kamel",
    nameEn: "Ahmed Ashraf Kamel",
    nameAr: "أحمد أشرف كامل",
    roleEn: "Egypt Coordinator",
    roleAr: "منسق مصر",
    image: "",
    group: "core"
  },
  {
    id: "maysara-ezz",
    nameEn: "Maysara Ezz",
    nameAr: "ميسرة عز",
    roleEn: "Events and Programs Manager",
    roleAr: "إدارة الفعاليات والبرامج",
    image: "",
    group: "core"
  }
];

export const mockCareers: CareerNode[] = [
  {
    id: "solar-engineer",
    titleEn: "Solar Energy Systems Engineer",
    titleAr: "مهندس نظم الطاقة الشمسية",
    skillsEn: ["Photovoltaics", "Grid Integration", "AutoCAD", "Project Management"],
    skillsAr: ["الأنظمة الكهروضوئية", "ربط الشبكات", "أوتوكاد", "إدارة المشاريع"],
    salaryEn: "$85,000 - $110,000 / year",
    salaryAr: "300,000 - 450,000 درهم / سنوياً",
    pathEn: "Bachelor in Engineering + Solar Specialist Certification",
    pathAr: "بكالوريوس هندسة + شهادة أخصائي طاقة شمسية معتمدة",
    demand: "High"
  },
  {
    id: "sustainability-consultant",
    titleEn: "Sustainability Consultant",
    titleAr: "مستشار استدامة بيئية",
    skillsEn: ["Carbon Accounting", "LEED Certification", "ESG Reporting"],
    skillsAr: ["حساب البصمة الكربونية", "شهادة LEED", "تقارير ESG"],
    salaryEn: "$75,000 - $98,000 / year",
    salaryAr: "280,000 - 380,000 درهم / سنوياً",
    pathEn: "Degree in Environmental Science + LEED Green Associate credential",
    pathAr: "درجة في العلوم البيئية + رخصة مستشار LEED الأخضر",
    demand: "Urgent"
  },
  {
    id: "agritech-expert",
    titleEn: "Agritech & Smart Farming Specialist",
    titleAr: "أخصائي زراعة ذكية وتكنولوجيا زراعية",
    skillsEn: ["Hydroponics", "IoT Sensors", "Precision Agriculture", "Data Analysis"],
    skillsAr: ["الزراعة المائية", "مستشعرات إنترنت الأشياء", "الزراعة الدقيقة", "تحليل البيانات"],
    salaryEn: "$70,000 - $92,000 / year",
    salaryAr: "250,000 - 350,000 درهم / سنوياً",
    pathEn: "Agricultural Tech diploma or degree + Hands-on IoT courses",
    pathAr: "دبلوم أو بكالوريوس تكنولوجيا زراعية + دورات إنترنت الأشياء",
    demand: "High"
  },
  {
    id: "environmental-lawyer",
    titleEn: "Climate Policy & Environmental Lawyer",
    titleAr: "محامي سياسات المناخ والقوانين البيئية",
    skillsEn: ["Environmental Law", "Policy Analysis", "Advocacy", "Negotiation"],
    skillsAr: ["القانون البيئي", "تحليل السياسات", "المدافعة البيئية", "التفاوض"],
    salaryEn: "$95,000 - $140,000 / year",
    salaryAr: "350,000 - 550,000 درهم / سنوياً",
    pathEn: "Law Degree (JD) + Environmental Law Specialization",
    pathAr: "درجة في القانون + تخصص القوانين والتشريعات البيئية",
    demand: "Medium"
  }
];

export const mockCarbonQuestions: CarbonQuestion[] = [
  {
    questionEn: "How do you commute to work or school daily?",
    questionAr: "كيف تتنقل إلى العمل أو الدراسة يومياً؟",
    options: [
      { textEn: "By private car (Gasoline)", textAr: "بسيارة خاصة (بنزين)", value: 4.6 },
      { textEn: "By public transport (Metro/Bus)", textAr: "بوسائل النقل العام (مترو/حافلة)", value: 1.2 },
      { textEn: "By Electric Vehicle / Hybrid", textAr: "بسيارة كهربائية أو هجينة", value: 2.0 },
      { textEn: "Bicycle / Walking", textAr: "الدراجة الهوائية أو المشي", value: 0 }
    ]
  },
  {
    questionEn: "What does your typical daily diet look like?",
    questionAr: "ما هو طبيعة نظامك الغذائي اليومي المعتاد؟",
    options: [
      { textEn: "Meat heavy (Beef/Lamb daily)", textAr: "غني باللحوم الحمراء يومياً", value: 3.3 },
      { textEn: "Balanced (Meat + Veggies)", textAr: "متوازن (لحوم خفيفة + خضروات)", value: 1.9 },
      { textEn: "Vegetarian / Vegan", textAr: "نباتي بالكامل", value: 0.8 }
    ]
  },
  {
    questionEn: "What is your main household energy source?",
    questionAr: "ما هو مصدر الطاقة الرئيسي لمنزلك؟",
    options: [
      { textEn: "Standard Grid Electricity", textAr: "شبكة الكهرباء العادية", value: 4.1 },
      { textEn: "Mix with Solar Panels", textAr: "مزيج مع ألواح طاقة شمسية", value: 1.5 },
      { textEn: "100% Renewable / Eco-friendly", textAr: "طاقة متجددة وصديقة للبيئة بالكامل", value: 0.2 }
    ]
  }
];

// ==========================================
// Member dashboard & Admin datasets
// (previously inlined in api.ts — relocated so every mock lives in one file)
// ==========================================

export const mockUserProfile: UserProfileResponse = {
  name: "عبد الله الشامسي",
  email: "abdalla.shamsi@example.com",
  city: "دبي",
  bio: "ناشط مناخي مهتم بالرقمنة والحلول الصديقة للبيئة.",
  stats: { ecoPoints: 240, virtualTrees: 3, earnedBadges: 2 },
  recentActivities: [
    {
      id: "1",
      titleAr: "أنهيت الدرس الأول بنجاح",
      titleEn: "Completed Lesson 1 Successfully",
      detailAr: "في مساق مقدمة الرقمنة المناخية",
      detailEn: "In Intro to Climate Digitization Course"
    },
    {
      id: "2",
      titleAr: "تم احتساب بصمتك الكربونية",
      titleEn: "Calculated your carbon footprint",
      detailAr: "النتيجة: 4.8 طن سنويًا (صديقة للبيئة)",
      detailEn: "Result: 4.8 Tons/Year (Eco-friendly)"
    }
  ],
  // ids below intentionally match mockCourses / mockEvents so the dashboard links resolve
  registeredCourses: [
    {
      id: "course-shift-internship",
      titleAr: "برنامج SHIFT للتدريب",
      titleEn: "SHIFT Internship",
      progress: 50
    }
  ],
  registeredEvents: [
    {
      id: "shift-first-cohort-graduation",
      titleAr: "تخرج الدفعة الأولى من برنامج SHIFT",
      titleEn: "SHIFT — First Cohort Graduation",
      date: "2026-02-01",
      status: "Confirmed"
    }
  ]
};

export const mockAdminStats: AdminStats = {
  totalVisitors: "4,520",
  activeMembers: "128",
  upcomingEvents: "3",
  publishedPosts: "12",
  recentActivities: [
    {
      textAr: "تم نشر فعالية 'هاكاثون المناخ 2026'",
      textEn: "New event 'Climate Hackathon 2026' published",
      timeAr: "منذ ساعتين",
      timeEn: "2 hours ago"
    },
    {
      textAr: "تم استقبال رسالة من منى المهيري",
      textEn: "Contact message received from Mona Al Mehairi",
      timeAr: "منذ 5 ساعات",
      timeEn: "5 hours ago"
    },
    {
      textAr: "تم تحديث مقالة تقرير التقدم",
      textEn: "Progress report blog post updated",
      timeAr: "أمس",
      timeEn: "Yesterday"
    }
  ]
};

export const mockAdminAnalytics: AnalyticItem[] = [
  { labelAr: "زيارات هذا الشهر", labelEn: "Visits This Month", value: "1,240", icon: "BarChart3" },
  { labelAr: "مستخدمون جدد", labelEn: "New Users", value: "85", icon: "Users" },
  { labelAr: "معدل الاحتفاظ", labelEn: "Retention Rate", value: "87%", icon: "TrendingUp" },
  { labelAr: "تذاكر محجوزة", labelEn: "Tickets Booked", value: "320", icon: "Ticket" }
];

export const mockAdminMessages: ContactMessage[] = [
  {
    id: "1",
    sender: "منى المهيري",
    email: "mona.m@example.com",
    subject: "طلب شراكة جامعية",
    message: "نود التعاون مع كلايمتيفاي لتنظيم ورشة عمل مناخية رقمية بجامعة زايد ومناقشة تفاصيل الحضور وتذاكر الطلاب.",
    date: "2026-07-19",
    isRead: false
  },
  {
    id: "2",
    sender: "سعيد النيادي",
    email: "saeed.n@example.com",
    subject: "استفسار عن التطوع",
    message: "كيف يمكنني تقديم طلب لإنشاء شابتر محلي لكلايمتيفاي في العين؟ هل هناك شروط معينة للشباب؟",
    date: "2026-07-18",
    isRead: true
  }
];
