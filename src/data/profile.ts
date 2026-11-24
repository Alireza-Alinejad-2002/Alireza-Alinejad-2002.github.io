// Single source for everything on the home page that is not a project.
// Numbers and dates follow docs/facts.md (CV Feb 2026, transcript, thesis, patent files).

export const person = {
  name: 'Alireza Alinejad',
  role: 'Aerospace engineer',
  tagline:
    'I design flying machines that learn from nature: from an 82.4-gram dragonfly-inspired flapping mechanism to the aircraft, simulators and estimators around them.',
  email: 'alireza.alinejad.eng@gmail.com',
  phone: { display: '+98 919 8020208', href: 'tel:+989198020208' },
  site: 'https://alireza-alinejad-2002.github.io/',
  linkedin: 'https://www.linkedin.com/in/2002-alireza-alinejad',
  github: 'https://github.com/Alireza-Alinejad-2002',
  cv: '/assets/CV_AlirezaAlinejad.pdf',
  thesis: '/assets/BScThesis_AlirezaAlinejad.pdf',
  transcript: 'https://edu.sharif.edu/v/400106592/E6E5F219F654688B5043BA67B99E2E2F',
};

export const objective =
  'As AI models evolve, we are closer than ever to a human-like robotic brain. That brain still needs an adaptable body that can act in the physical world and genuinely ease human lives. I want to build those bodies, merging intelligent design with purposeful function to close the gap Moravec’s paradox describes: what is easy for people remains hard for robots.';

export const roadmap = [
  {
    title: 'Model-based safety',
    items: ['6-DoF dynamics modeling', 'Simulink PID / MPC loops', 'Flapping-wing MAV prototyping', 'ROS2 navigation deployment'],
  },
  {
    title: 'LLMs with guarantees',
    items: ['LLM task and spec synthesis', 'CLF / CBF-QP safety shield', 'Hybrid reach-avoid switching', 'Lyapunov invariance proofs'],
  },
  {
    title: 'Scaled strategic autonomy',
    items: ['Partial-information differential games', 'Multi-agent capture-the-flag', 'Distributed MPC', 'Robust sensor orchestration'],
  },
];

export const interests = [
  'Robotics',
  'Machine learning',
  'Control & autonomy',
  'Computer vision',
  'Swarm intelligence',
  'Mechatronics',
  'Bio-inspired flight',
];

export const education = {
  school: 'Sharif University of Technology',
  degree: 'B.Sc. in Aerospace Engineering',
  period: 'Sep 2021 – Feb 2026',
  gpa: '3.67 / 4 · 17.40 / 20',
  note: 'Thesis: Design and development of a flapping-wing mechanism inspired by the dragonfly (defended Sep 2025)',
};

export const experience = [
  {
    role: 'Researcher, Smart Systems Research Laboratory',
    org: 'Aerospace Engineering, Sharif University of Technology',
    period: 'Aug 2023 – Jan 2026',
    detail: 'Supervisor: Prof. Seyed Hossein Pourtakdoust',
  },
  {
    role: 'Teaching assistant, Aircraft Design',
    org: 'Sharif University of Technology',
    period: 'Sep 2025 – Jan 2026',
    detail: 'Prof. Afshin Banazadeh',
  },
  {
    role: 'Teaching assistant, Numerical Methods',
    org: 'Sharif University of Technology',
    period: 'Sep 2025 – Jan 2026',
    detail: 'Dr. Hossein Hashemi Nasab',
  },
  {
    role: 'Teaching assistant, Control Systems Lab',
    org: 'Sharif University of Technology',
    period: 'Sep 2024 – Jan 2025',
    detail: 'Prof. Alireza Sharifi',
  },
  {
    role: 'Teaching assistant, Engineering Dynamics',
    org: 'Sharif University of Technology',
    period: 'Sep 2023 – Jan 2024',
    detail: 'Prof. Alireza Sharifi',
  },
];

export const skills: { group: string; items: string[] }[] = [
  {
    group: 'Aircraft design & flight dynamics',
    items: ['OpenVSP', 'AVL', 'Digital DATCOM', 'JSBSim', 'FlightGear', 'PX4 (SITL)', 'AAA', 'ANSYS Fluent', 'ABAQUS', 'CS-23'],
  },
  {
    group: 'Modeling, control & estimation',
    items: ['MATLAB', 'Simulink', 'Simscape', 'PID / state-space design', 'INS mechanization', 'EES'],
  },
  {
    group: 'Robotics & machine learning',
    items: ['ROS2', 'Gazebo', 'TurtleBot3', 'NAO / Choregraphe', 'Python', 'PyTorch', 'TensorFlow', 'pandas'],
  },
  {
    group: 'Mechanical design & hardware',
    items: ['SOLIDWORKS', 'FDM prototyping', 'Arduino', 'Raspberry Pi', 'C++', 'Linux', 'LaTeX'],
  },
];

export const languages = [
  { name: 'English', level: 'TOEFL iBT 97 (R24 · L28 · S24 · W21)' },
  { name: 'Persian', level: 'Native' },
];

export const honors = [
  {
    title: 'Ranked 17th of 78 in the aerospace engineering cohort',
    org: 'Sharif University of Technology',
    period: '2021 – 2026',
  },
  {
    title: 'Top 0.3% nationwide',
    org: 'Iranian University Entrance Exam (Mathematics & Physics)',
    period: 'Jul 2021',
  },
];

export const leadership = [
  {
    title: 'Head of the Welfare Committee',
    org: 'Aerospace Engineering Student Council, SUT',
    period: 'May 2023 – Sep 2024',
  },
  {
    title: 'Technical editor',
    org: 'OWJ aerospace trade magazine, SUT',
    period: 'Oct 2022 – Apr 2023',
  },
  {
    title: 'Member, environmental programs',
    org: 'Association of Environmentalists, SUT',
    period: 'Apr 2023 – Dec 2023',
  },
];

// Legacy image paths are kept: the CV PDF links to them.
export const certifications = [
  {
    title: 'Deep Learning Fundamentals: Unlocking the Power of AI',
    date: 'Aug 2025',
    href: '/images/certifications/Deep Learning Fundamentals Unlocking the Power of Ai.png',
  },
  {
    title: 'Artificial Neural Networks and Machine Learning using MATLAB',
    date: 'Jul 2024',
    href: '/images/certifications/Artificial Neural Network and Machine Learning using MATLAB_Certificate.png',
  },
  { title: 'Simulink Onramp', date: 'Mar 2024', href: '/images/certifications/Simulink_Onramp.png' },
  { title: 'MATLAB Onramp', date: 'Nov 2022', href: '/images/certifications/Matlab_Onramp.png' },
];

export const publications = [
  {
    tag: 'P.1',
    kind: 'Patent application',
    title: 'Design and Development of a Dragonfly-Inspired Flapping Mechanism',
    authors: 'A. Alinejad, T. Alikhani, S. H. Pourtakdoust, S. M. S. Mousavi',
    venue: 'Iran Intellectual Property Office · Application No. 140450140003008393 · filed 2025, pending',
    href: '/work/dragonfly-fwmav/',
    linkLabel: 'Project',
  },
  {
    tag: 'T.1',
    kind: 'B.Sc. thesis',
    title: 'Design and Development of a Flapping-Wing Mechanism Inspired by Dragonfly',
    authors: 'A. Alinejad, T. Alikhani · supervisor S. H. Pourtakdoust',
    venue: 'Sharif University of Technology · Sep 2025',
    href: '/assets/BScThesis_AlirezaAlinejad.pdf',
    linkLabel: 'PDF',
  },
  {
    tag: 'R.1',
    kind: 'Team review paper',
    title: 'Evolution of Solar-Powered Aircraft for Continuous Flight',
    authors: 'A. Alinejad, A. Yousefi, M. Tavasolinia',
    venue: 'Introduction to Aerospace Engineering, Sharif University of Technology · Jun 2022',
    href: '/docs/solar-aircraft-review-2022.pdf',
    linkLabel: 'PDF',
  },
  {
    tag: 'L.1',
    kind: 'Paper presentation',
    title: 'Machine-learning-aided navigation: an improved INS solution',
    authors: 'Presented by A. Alinejad · Navigation & Guidance course',
    venue: 'On Mahdi et al., “A machine learning approach for an improved inertial navigation system solution,” Sensors 22(4):1687, 2022',
    href: '/docs/ml-ins-presentation.pdf',
    linkLabel: 'Slides',
  },
];
