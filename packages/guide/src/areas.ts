// Plain-language guide to the IT systems of a business. Written in our own words for owners
// who are not IT people. Each area: what it is, why it matters, its parts, warning signs,
// quick wins and questions to ask whoever runs your IT.

export type Pillar =
  | "foundation"
  | "identity"
  | "devices"
  | "network"
  | "applications"
  | "data"
  | "visibility";

/** 1 = fix first (immediate risk) … 4 = advanced, once the basics are solid. */
export type Phase = 1 | 2 | 3 | 4;

export interface Part {
  name: string;
  plain: string;
}

export interface Area {
  slug: string;
  title: string;
  /** What IT people call it. */
  technical: string;
  pillar: Pillar;
  phase: Phase;
  /** One sentence for cards. */
  oneLiner: string;
  summary: string;
  whyItMatters: string;
  parts: Part[];
  warningSigns: string[];
  quickWins: string[];
  questions: string[];
  /** Mainly relevant to engineering, lab or compute-heavy companies. */
  specialist?: boolean;
  related: string[];
}

export const AREAS: Area[] = [
  {
    slug: "company-context",
    title: "How your IT is run",
    technical: "Company and IT context, governance and documentation",
    pillar: "foundation",
    phase: 1,
    oneLiner: "Who decides, who fixes things, and where it is all written down.",
    summary:
      "Before any tool, there is the way IT is organised: who is responsible, how problems and requests are handled, what the budget is, and whether the important knowledge is written down rather than kept in one person's head.",
    whyItMatters:
      "Most IT trouble in small companies is not a broken server but a missing owner or a missing document. When the one person who knows leaves or is ill, a simple problem becomes a long outage.",
    parts: [
      {
        name: "The business picture",
        plain:
          "Size, locations, teams, how people work (office, hybrid, remote, lab) and which processes cannot stop.",
      },
      {
        name: "People and suppliers",
        plain:
          "Who makes decisions, who supports users and when, and which outside companies help.",
      },
      {
        name: "Rules and processes",
        plain:
          "A simple plan and budget for IT, how changes are approved, how incidents and requests are handled, and what support people can expect.",
      },
      {
        name: "Documentation",
        plain:
          "Diagrams of systems and data, a list of important data, and step-by-step guides for backups, recovery, new joiners and leavers.",
      },
    ],
    warningSigns: [
      "Only one person knows how something works or where a password is.",
      "Nobody can say which three systems the business cannot lose for a day.",
      "The same problems come back every month and nobody owns them.",
    ],
    quickWins: [
      "Write down your three most critical systems and who owns each one.",
      "Keep a single shared page listing suppliers, contacts and contract dates.",
      "Agree one place where people report IT problems, and keep a log.",
    ],
    questions: [
      "If you were away for two weeks, who could keep our systems running?",
      "Where are our network and system diagrams, and when were they last updated?",
      "What IT risk worries you most right now?",
    ],
    related: ["identity-access", "assets-vendors", "security-compliance"],
  },
  {
    slug: "identity-access",
    title: "Who can log in, and to what",
    technical: "Identity, access and AAA (authentication, authorisation, accounting)",
    pillar: "identity",
    phase: 1,
    oneLiner: "Accounts, passwords, two-step login and who has access to what.",
    summary:
      "Every person and service gets an account. This area covers where accounts live, how people prove who they are (passwords and a second step like a phone prompt), and how access to each system is granted, reviewed and removed.",
    whyItMatters:
      "Stolen passwords are the most common way attackers get in. Two-step login and tidy admin accounts stop most of these attacks for almost no cost.",
    parts: [
      {
        name: "Directory",
        plain:
          "The central list of user accounts (for example Microsoft Entra ID, Active Directory or Google), ideally one account per person for everything.",
      },
      {
        name: "Shared and emergency accounts",
        plain:
          "Accounts several people use must be listed, logged and have passwords changed regularly. A sealed emergency admin account lets you get back in if everything else fails.",
      },
      {
        name: "Proving who you are",
        plain:
          "Password rules, self-service reset, two-step login (MFA) on everything reachable from the internet, and smarter rules such as blocking logins from unusual countries or unmanaged devices.",
      },
      {
        name: "Single sign-on and guests",
        plain: "One login for many apps, and a controlled way to give partners or guests access.",
      },
      {
        name: "Who gets what",
        plain:
          "Access by role or group, a simple request and approval flow, regular reviews, and separate, tracked admin accounts.",
      },
    ],
    warningSigns: [
      "Any internet-facing system (email, VPN, admin portals) works with just a password.",
      "People use their everyday account as an administrator.",
      "Nobody has checked in the last year who can access finance, HR or customer data.",
    ],
    quickWins: [
      "Turn on two-step login for email, VPN and every admin portal this week.",
      "Give admins a separate admin account and remove admin rights from daily accounts.",
      "Create and safely store one emergency admin account, and test it.",
    ],
    questions: [
      "Is two-step login enforced on every system reachable from outside, with no exceptions?",
      "When someone leaves, how quickly is all their access removed, and is it checked?",
      "Do we still use old login methods such as basic authentication or plain LDAP?",
    ],
    related: ["user-lifecycle", "security-compliance", "web-public"],
  },
  {
    slug: "servers-storage",
    title: "Servers and storage",
    technical: "Infrastructure and datacenter: physical, servers, virtualisation, storage",
    pillar: "devices",
    phase: 2,
    oneLiner: "The machines and disks your company runs on, in a server room or datacenter.",
    summary:
      "If you run anything on your own hardware, this is the room, the power and cooling, the physical and virtual servers, and the storage where shared files and data live.",
    whyItMatters:
      "A server nobody patches, a full disk or a failed air-conditioner can stop the whole company. Knowing what you have, and keeping it maintained, prevents most surprises.",
    parts: [
      {
        name: "The room",
        plain:
          "Racks, power strips, backup batteries (UPS), cooling, who can get in, and diagrams of what is plugged where.",
      },
      {
        name: "Servers",
        plain:
          "A list of every physical and virtual server with its system version and patch level, naming rules, a standard setup routine and planned maintenance windows.",
      },
      {
        name: "Virtualisation",
        plain:
          "Software such as VMware, Hyper-V or Proxmox that runs many virtual servers on a few machines, with failover, templates and snapshots.",
      },
      {
        name: "Storage",
        plain:
          "File shares and storage systems, how disks are protected (RAID), who can read what, space limits, performance and archiving.",
      },
    ],
    warningSigns: [
      "There is no up-to-date list of servers and what they do.",
      "Updates are applied 'when someone has time'.",
      "Storage fills up without warning, or nobody watches power and temperature.",
    ],
    quickWins: [
      "Make a simple list of every server: name, purpose, owner, system version.",
      "Pick a monthly maintenance window and announce it.",
      "Set alerts for disk space, power and temperature.",
    ],
    questions: [
      "Where are our single points of failure: one server, one disk, one link?",
      "When was each server last patched?",
      "Are storage permissions and space limits documented?",
    ],
    related: ["backup-recovery", "monitoring", "cloud"],
  },
  {
    slug: "linux-engineering",
    title: "Engineering servers and tools",
    technical: "Linux and engineering environment",
    pillar: "devices",
    phase: 2,
    specialist: true,
    oneLiner: "The Linux machines, tools and licences engineers use every day.",
    summary:
      "Engineering teams often work on shared Linux servers with specialised design tools, shared project folders and software licences served from a central licence server.",
    whyItMatters:
      "If the licence server stops or a tool environment changes by accident, every engineer can be blocked at once. Consistent, documented setups make the environment reliable and repeatable.",
    parts: [
      {
        name: "Standard server build",
        plain:
          "A written, repeatable way to set up a Linux server: naming, addresses, updates, firewall, security hardening, time sync, logging, monitoring and backup agents.",
      },
      {
        name: "Remote access",
        plain:
          "Logging in with company accounts over SSH or remote desktop tools, ideally through a secured jump server.",
      },
      {
        name: "Desktop and tools",
        plain:
          "The engineering desktop, tool versions per project, common shells and developer tools, kept reproducible.",
      },
      {
        name: "Shared folders",
        plain:
          "Home, project and scratch folders on the network, with permissions and space limits.",
      },
      {
        name: "Licence servers",
        plain:
          "Servers that hand out software licences: redundancy, renewals, expiry tracking, automatic restarts and alerts.",
      },
    ],
    warningSigns: [
      "Each server was set up differently by hand.",
      "A licence expired and work stopped before anyone noticed.",
      "Engineers log in to servers directly from the internet.",
    ],
    quickWins: [
      "Write the server build steps into a checklist or script.",
      "Add expiry and status alerts to every licence server.",
      "Route admin access through one jump server with two-step login.",
    ],
    questions: [
      "Can we rebuild an engineering server the same way tomorrow?",
      "Who gets alerted if a licence server goes down at night?",
      "Are tool environments version-controlled?",
    ],
    related: ["compute-farm", "devops", "servers-storage"],
  },
  {
    slug: "compute-farm",
    title: "Heavy computing (HPC)",
    technical: "HPC and compute farm",
    pillar: "devices",
    phase: 3,
    specialist: true,
    oneLiner: "Clusters of machines that run big simulations and jobs in a queue.",
    summary:
      "Companies with heavy calculations share a cluster of computers. A scheduler (such as Slurm or LSF) queues jobs and decides who runs what, when, and with which licences.",
    whyItMatters:
      "A badly tuned cluster wastes expensive hardware and licences, and lets one team block everyone else. Good rules and monitoring keep projects on time.",
    parts: [
      {
        name: "Scheduler and cluster",
        plain:
          "The queue software, the head, login and compute machines, queues, limits per job and accounting per team or project.",
      },
      {
        name: "Smarter scheduling",
        plain:
          "Waiting for free licences before starting, fair sharing between teams, letting urgent jobs jump ahead, and reserving capacity in advance.",
      },
      {
        name: "Monitoring",
        plain: "Health of each machine, queue length, who is using what and how fast jobs run.",
      },
    ],
    warningSigns: [
      "Jobs fail because licences ran out mid-run.",
      "One user's jobs regularly block a whole team.",
      "Nobody can say how busy the cluster is or who uses it.",
    ],
    quickWins: [
      "Turn on licence-aware scheduling.",
      "Set fair-share rules and per-job limits.",
      "Put a dashboard on queue length and node health.",
    ],
    questions: [
      "How full is the cluster on a typical week, and who uses it most?",
      "What happens to running jobs when a machine fails?",
      "Have we compared on-site capacity with renting cloud capacity for peaks?",
    ],
    related: ["linux-engineering", "cloud", "monitoring"],
  },
  {
    slug: "devops",
    title: "Code, builds and automation",
    technical: "Engineering and DevOps systems",
    pillar: "applications",
    phase: 3,
    specialist: true,
    oneLiner: "Where code lives, how it is built and tested, and how changes are automated.",
    summary:
      "Development teams keep code in repositories, build and test it automatically, run software in containers, and use automation scripts to configure servers the same way every time.",
    whyItMatters:
      "Code and automation are often the company's most valuable asset. Leaked passwords inside build pipelines and undocumented automation are frequent and serious risks.",
    parts: [
      {
        name: "Engineering services",
        plain:
          "Code repositories (GitLab, SVN and similar), requirement and quality tools, and internal portals.",
      },
      {
        name: "Builds and tests (CI/CD)",
        plain:
          "The machines that build and test code automatically, and how they handle passwords and keys safely.",
      },
      {
        name: "Containers",
        plain:
          "Packaged applications (Docker, registries, Kubernetes) and keeping their base images patched.",
      },
      {
        name: "Configuration automation",
        plain:
          "Scripts that set up servers (for example Ansible), who may run them, how secrets are stored, and change control for production.",
      },
    ],
    warningSigns: [
      "Passwords or keys are written in plain text in pipeline files.",
      "Only one person can run or understand the automation.",
      "Container images are never rebuilt or scanned.",
    ],
    quickWins: [
      "Move pipeline secrets into a proper secrets store.",
      "Back up repositories and test a restore.",
      "Scan container images and rebuild them on a schedule.",
    ],
    questions: [
      "Are our code repositories backed up and access-controlled?",
      "Who can run automation against production, and is it reviewed?",
      "Are engineering tools documented and owned by someone?",
    ],
    related: ["linux-engineering", "security-compliance", "backup-recovery"],
  },
  {
    slug: "endpoints",
    title: "Laptops and computers",
    technical: "Workstations and endpoint management",
    pillar: "devices",
    phase: 2,
    oneLiner: "Buying, setting up, updating and protecting every company device.",
    summary:
      "Every laptop and desktop should be bought to a standard, set up automatically, kept up to date, protected against malware and encrypted, and tracked until it is retired.",
    whyItMatters:
      "A lost, unencrypted laptop or an unpatched computer is one of the easiest ways to lose data. Central device management makes protection automatic instead of hopeful.",
    parts: [
      {
        name: "Hardware",
        plain: "Where devices are bought, standard models, warranty, spare stock and asset tags.",
      },
      {
        name: "Device management (MDM)",
        plain:
          "A central system such as Intune, Jamf or Google that installs apps, pushes updates and checks each device meets the rules.",
      },
      {
        name: "Protection",
        plain:
          "Antivirus or EDR, disk encryption (BitLocker, FileVault), firewall, no everyday admin rights, certificates, USB rules and remote wipe.",
      },
      { name: "Help for users", plain: "Remote assistance tools and a helpdesk." },
    ],
    warningSigns: [
      "Some laptops are not in any management system.",
      "You cannot confirm every device is encrypted.",
      "Users are local administrators by default.",
    ],
    quickWins: [
      "Enrol every company device in one management system.",
      "Turn on disk encryption and automatic updates everywhere.",
      "Remove everyday admin rights; use a managed admin password tool (LAPS).",
    ],
    questions: [
      "Are all laptops enrolled, encrypted and updating automatically?",
      "Is antivirus or EDR monitored, or just installed?",
      "Can we wipe a lost laptop remotely today?",
    ],
    related: ["user-lifecycle", "identity-access", "assets-vendors"],
  },
  {
    slug: "workplace",
    title: "Office, meeting rooms and labs",
    technical: "Office, laboratory and workplace IT",
    pillar: "network",
    phase: 2,
    oneLiner: "Desks, meeting rooms, printers, labs and building security.",
    summary:
      "The physical workplace has its own IT: desk equipment and network ports, meeting-room screens and video calls, printers and scanners, lab computers and instruments, and alarms, badges and cameras.",
    whyItMatters:
      "These everyday devices are often forgotten, yet a lab PC on the main network or a printer with default settings can be an open door, and broken meeting rooms waste time daily.",
    parts: [
      {
        name: "Desks",
        plain: "Standard equipment packages, screens, docks, network ports and cabling.",
      },
      {
        name: "Meeting rooms",
        plain:
          "Screens, cameras and microphones, a limited room account for Teams or Meet, room calendars and simple how-to guides.",
      },
      {
        name: "Labs",
        plain:
          "Lab workstations and instrument PCs on their own isolated network, controlled remote access, rules for contractors, and data moved off local disks.",
      },
      {
        name: "Printers and scanners",
        plain:
          "Print servers or cloud print, secure release with a PIN or badge, scan-to-email settings, supplies and maintenance.",
      },
      {
        name: "Building security",
        plain:
          "Alarm, badges, cameras (storage and access), visitor Wi-Fi and secure storage rooms.",
      },
    ],
    warningSigns: [
      "Lab or instrument PCs sit on the same network as everyone else.",
      "Lab data lives only on local disks.",
      "Every meeting starts with ten minutes of cable trouble.",
    ],
    quickWins: [
      "Move lab and instrument devices to a separate network.",
      "Put a one-page guide in each meeting room.",
      "Turn on secure print release for confidential documents.",
    ],
    questions: [
      "Are lab workstations isolated and their data backed up?",
      "Who can access camera recordings and badge logs?",
      "Are meeting rooms and desk setups standardised?",
    ],
    related: ["network", "endpoints", "backup-recovery"],
  },
  {
    slug: "network",
    title: "Network and internet",
    technical: "Network and connectivity",
    pillar: "network",
    phase: 2,
    oneLiner: "Firewalls, Wi-Fi, VPN and how traffic is separated and protected.",
    summary:
      "Your network connects everything: the internet lines, the firewall, switches and Wi-Fi, the separate zones for guests, labs and servers, and the VPN that lets people and offices connect from outside.",
    whyItMatters:
      "A flat network lets one infected laptop reach everything. Separation, reviewed firewall rules and a backup internet line keep problems small and the business online.",
    parts: [
      {
        name: "Design",
        plain:
          "Core firewall, router and switch layout, redundancy, an up-to-date diagram with address ranges, and basic services such as DNS, DHCP and time.",
      },
      {
        name: "Internet",
        plain:
          "Providers, a second line for failover, and rules about what may go out to the internet.",
      },
      {
        name: "Zones",
        plain:
          "Separate networks for staff, servers, guests, labs and management, with firewall rules that are reviewed and owned.",
      },
      {
        name: "VPN",
        plain:
          "Secure links between offices, to the cloud, for remote staff and for suppliers, with rules on split tunnelling.",
      },
      {
        name: "Wi-Fi",
        plain:
          "Central management, separate staff and guest networks, and certificate-based login instead of one shared password.",
      },
    ],
    warningSigns: [
      "Guests, lab devices and servers share one network.",
      "Nobody knows why half the firewall rules exist.",
      "Staff Wi-Fi uses one password that never changes.",
    ],
    quickWins: [
      "Split guest Wi-Fi from the company network.",
      "Review firewall rules and give each one an owner.",
      "Require two-step login on the VPN and time-limit supplier access.",
    ],
    questions: [
      "Is the network segmented, and is it documented?",
      "Do we have a second internet line, and was failover tested?",
      "How do suppliers connect, and is that access audited?",
    ],
    related: ["web-public", "cloud", "workplace"],
  },
  {
    slug: "web-public",
    title: "Website and public services",
    technical: "Web, public services and DMZ",
    pillar: "network",
    phase: 1,
    oneLiner: "Your domain, website, customer portal and social media accounts.",
    summary:
      "Everything the outside world can reach: your domain name and DNS, the public website, any customer portal, the protection in front of them (CDN, WAF, DDoS), and the company's social media accounts.",
    whyItMatters:
      "Losing control of your domain or a social account can take the business offline or damage its reputation in hours. These accounts are often owned by one person's private email.",
    parts: [
      {
        name: "Internet footprint",
        plain:
          "Public IP addresses, DNS records, who controls the domain registrar account, and protection such as Cloudflare.",
      },
      {
        name: "Website",
        plain:
          "Hosting and content system, certificates (the padlock), content updates and security patches.",
      },
      {
        name: "Customer portal",
        plain: "Where it is hosted, two-step login for customers and admins, and security reviews.",
      },
      {
        name: "Social media",
        plain:
          "Company-owned accounts, two-step login, recovery email and phone, and removing access when people leave.",
      },
    ],
    warningSigns: [
      "The domain or social accounts are registered to a former employee or agency.",
      "The website's certificate has expired before.",
      "The site's software is rarely updated.",
    ],
    quickWins: [
      "Move domain, hosting and social accounts to company-owned logins with two-step login.",
      "Set alerts for certificate and domain expiry.",
      "Put the website behind a WAF and DDoS protection.",
    ],
    questions: [
      "Who owns our domain registrar account, and is it protected with two-step login?",
      "Are public services monitored for uptime and certificate expiry?",
      "Who can post on our company social accounts?",
    ],
    related: ["identity-access", "monitoring", "security-compliance"],
  },
  {
    slug: "cloud",
    title: "Cloud",
    technical: "Cloud resource integration: VMs, CAD/EDA, HPC, connectivity and storage",
    pillar: "network",
    phase: 4,
    oneLiner: "Servers, storage and computing you rent from AWS, Azure or Google.",
    summary:
      "Cloud lets you rent servers, storage and computing power by the hour. This area covers which workloads run there, how they connect to your own sites, who can manage them and how costs are kept under control.",
    whyItMatters:
      "Cloud is flexible but easy to overspend on or misconfigure. Clear rules on access, cost tags and backups turn it from a risk into an advantage.",
    parts: [
      {
        name: "Cloud servers",
        plain:
          "Standard machine sizes, hardened images, start/stop schedules, patching, monitoring and backups.",
      },
      {
        name: "Engineering in the cloud",
        plain:
          "Pre-built tool environments, extra capacity for peaks, data transfer costs and protecting sensitive design data.",
      },
      {
        name: "Cloud HPC",
        plain:
          "Sending overflow jobs from your cluster to the cloud, cheaper interruptible machines, licences and budget alerts.",
      },
      {
        name: "Connecting sites to cloud",
        plain:
          "Private links (Direct Connect, ExpressRoute), redundancy, firewall rules, latency and change control.",
      },
      {
        name: "Cloud storage",
        plain:
          "Object and file storage, syncing with your sites, encryption, data tiers, egress fees and a local backup copy.",
      },
    ],
    warningSigns: [
      "The monthly cloud bill is a surprise.",
      "Many people use powerful or root accounts.",
      "Nobody can say which project owns which resource.",
    ],
    quickWins: [
      "Tag every resource with owner and project, and set budget alerts.",
      "Remove root use and wildcard permissions.",
      "Back up cloud workloads and test a restore.",
    ],
    questions: [
      "What should live in the cloud versus on-site, and why?",
      "Are cloud costs reviewed every month by an owner?",
      "Is the link between our sites and the cloud redundant and monitored?",
    ],
    related: ["network", "backup-recovery", "assets-vendors"],
  },
  {
    slug: "monitoring",
    title: "Monitoring and alerts",
    technical: "Monitoring, logging and alerting",
    pillar: "visibility",
    phase: 2,
    oneLiner: "Knowing something is wrong before your users or customers tell you.",
    summary:
      "Monitoring watches the health of devices, servers, cloud and public services. Logging keeps a record of what happened. Alerting tells the right person, at the right time, with a guide on what to do.",
    whyItMatters:
      "Without monitoring you find out about problems from angry users. Without logs you cannot tell what happened after a security incident.",
    parts: [
      {
        name: "Infrastructure",
        plain:
          "Checks on servers, network gear, power, printers, access points and cloud resources.",
      },
      {
        name: "Dashboards",
        plain:
          "Graphs (Grafana, Prometheus) for server load, storage, licences and key applications.",
      },
      {
        name: "External checks",
        plain: "Is the office reachable? Is the website up and is its certificate valid?",
      },
      {
        name: "Logs and alerts",
        plain:
          "Central logs for systems, firewall, VPN, logins and admin actions, kept long enough and searchable; alert channels, on-call, escalation, severity levels and runbooks.",
      },
    ],
    warningSigns: [
      "Users report outages before IT knows.",
      "Alerts are so noisy that people ignore them.",
      "Logs are spread across devices and deleted quickly.",
    ],
    quickWins: [
      "Add uptime and certificate checks for your website and portal.",
      "Send all logins and admin activity to one central log.",
      "Write a short runbook for your five most common alerts.",
    ],
    questions: [
      "Who is alerted when something breaks at night or at the weekend?",
      "How long do we keep logs, and can we search them?",
      "Do our alerts come with clear steps to fix them?",
    ],
    related: ["security-compliance", "servers-storage", "web-public"],
  },
  {
    slug: "backup-recovery",
    title: "Backups and recovery",
    technical: "Backup, disaster recovery and business continuity",
    pillar: "data",
    phase: 1,
    oneLiner: "Getting your data and business back after a mistake, failure or attack.",
    summary:
      "Backups are copies of your data. Disaster recovery is the plan to get systems running again. Business continuity is how the company keeps working meanwhile. All three only count if they have been tested.",
    whyItMatters:
      "Ransomware, a deleted folder or a dead server can happen to anyone. A tested backup, with one copy attackers cannot reach, is the difference between a bad day and losing the business.",
    parts: [
      {
        name: "What is backed up",
        plain:
          "Servers, file shares and databases, cloud data, code repositories, network device settings, SaaS and Microsoft 365 or Google data, and important laptops.",
      },
      {
        name: "How",
        plain:
          "The main backup system, cloud backups, an off-site copy and an immutable or offline copy that cannot be changed or deleted.",
      },
      {
        name: "Running it",
        plain:
          "Schedules, how long copies are kept, encryption, alerts when a backup fails, regular restore tests and a named owner.",
      },
      {
        name: "Disaster recovery",
        plain:
          "A second site, target recovery time (RTO) and acceptable data loss (RPO), runbooks, tests, a business impact analysis and a crisis communication plan.",
      },
    ],
    warningSigns: [
      "Nobody has restored a file from backup in the last three months.",
      "All backups are reachable with the same admin password.",
      "You assume Microsoft 365 or Google keeps a backup for you.",
    ],
    quickWins: [
      "Test a real restore this month and write down how long it took.",
      "Keep one immutable or offline copy.",
      "Back up Microsoft 365 or Google Workspace with a separate tool.",
    ],
    questions: [
      "How long would it take to get our three most critical systems back?",
      "How much data could we lose: an hour, a day, a week?",
      "Is there a copy that ransomware could not encrypt or delete?",
    ],
    related: ["servers-storage", "productivity-suite", "security-compliance"],
  },
  {
    slug: "productivity-suite",
    title: "Email, calendar and files",
    technical: "Productivity suite (Microsoft 365 or Google Workspace)",
    pillar: "applications",
    phase: 2,
    oneLiner: "Microsoft 365 or Google Workspace: mail, meetings, files and templates.",
    summary:
      "The tools everyone uses all day: email and calendars, Teams, Meet or Zoom, shared files and sites, phone systems, and company templates and task boards.",
    whyItMatters:
      "Email is the front door for phishing, and shared files are where most company data lives. Good settings for spam protection, sharing and admin roles prevent most incidents.",
    parts: [
      {
        name: "Platform",
        plain: "Which suite, licences, who owns the tenant, admin roles and company branding.",
      },
      {
        name: "Mail and calendar",
        plain:
          "Personal, shared and system mailboxes, groups, delegation, anti-spam and anti-phishing, mail rules and room calendars.",
      },
      {
        name: "Meetings",
        plain:
          "Teams, Meet or Zoom, guest access, recording and transcription rules, phone numbers and call queues, and the company directory.",
      },
      {
        name: "Files",
        plain:
          "SharePoint, OneDrive or Google Drive, official sites, permissions, external sharing, classification and retention.",
      },
      {
        name: "Templates and tasks",
        plain: "Document templates, logos and signatures, and task tools such as Planner.",
      },
    ],
    warningSigns: [
      "Files are shared with 'anyone with the link' by default.",
      "Many people are global administrators.",
      "Phishing emails regularly reach inboxes.",
    ],
    quickWins: [
      "Limit global admins to two or three named people.",
      "Restrict external sharing to named guests.",
      "Turn on the built-in anti-phishing and impersonation protection.",
    ],
    questions: [
      "Who are our global admins, and do they use two-step login?",
      "Is our Microsoft 365 or Google data backed up independently?",
      "What are our rules for recording and transcribing meetings?",
    ],
    related: ["backup-recovery", "identity-access", "business-apps"],
  },
  {
    slug: "business-apps",
    title: "Business apps and SaaS",
    technical: "Business applications, SaaS, automation and reporting",
    pillar: "applications",
    phase: 3,
    oneLiner: "HR, finance, ticketing, low-code automation and reports.",
    summary:
      "Beyond email, companies run many online services: HR, finance, travel, e-signature, purchasing, ticketing and a knowledge base. Many also build small automations and dashboards on top.",
    whyItMatters:
      "Each subscription holds company data and another login. Undocumented automations break silently when their author leaves.",
    parts: [
      {
        name: "Admin systems",
        plain: "HR portal, finance, travel, e-signature, purchasing, ticketing and knowledge base.",
      },
      {
        name: "Automation and low-code",
        plain:
          "Power Apps, Power Automate or Apps Script: who can build, what data they can reach, approvals and a security review.",
      },
      {
        name: "Reporting",
        plain:
          "Power BI, Looker Studio or Grafana, data sources, refresh schedules and who owns each dashboard.",
      },
    ],
    warningSigns: [
      "Nobody has a full list of paid subscriptions.",
      "A key automation runs under a former employee's account.",
      "Reports show different numbers for the same thing.",
    ],
    quickWins: [
      "List every SaaS subscription with owner, cost and renewal date.",
      "Move automations to service accounts and document them.",
      "Connect important apps to single sign-on.",
    ],
    questions: [
      "Which SaaS tools hold customer or employee data?",
      "Who reviews new automations before they go live?",
      "Who owns each important report?",
    ],
    related: ["assets-vendors", "productivity-suite", "ai"],
  },
  {
    slug: "user-lifecycle",
    title: "Joiners, movers and leavers",
    technical: "Admin, HR and user lifecycle operations",
    pillar: "identity",
    phase: 3,
    oneLiner: "Getting people set up on day one, and fully removed on their last day.",
    summary:
      "Every new hire needs accounts, email, a prepared laptop and the right access. Every leaver needs all of it removed quickly, their data handed over and their equipment returned.",
    whyItMatters:
      "Leftover accounts of former staff are a classic way in for attackers, and a messy first day costs a new hire a week of productivity.",
    parts: [
      {
        name: "Onboarding",
        plain:
          "Accounts and groups, mailbox, a prepared device with the right software, approved access and a first-day checklist.",
      },
      {
        name: "Offboarding",
        plain:
          "Disable the account and end all sessions, hand over mailbox and files, collect the device, remove SaaS, VPN and badge access, and keep data on hold if legally needed.",
      },
      {
        name: "Equipment",
        plain: "Assigning laptops and accessories, shipping and returns, and repairs.",
      },
    ],
    warningSigns: [
      "Former employees still appear in the account list.",
      "Each new hire's setup is different.",
      "Laptops of leavers are not always returned.",
    ],
    quickWins: [
      "Write one onboarding and one offboarding checklist, and use them every time.",
      "Disable accounts on the last day and sign out all sessions.",
      "Review the account list against the HR list every month.",
    ],
    questions: [
      "How quickly is all access removed when someone leaves?",
      "Is onboarding documented and followed for every hire?",
      "Who checks that leavers' devices come back?",
    ],
    related: ["identity-access", "endpoints", "business-apps"],
  },
  {
    slug: "assets-vendors",
    title: "Assets, suppliers and costs",
    technical: "Asset, vendor and contract management",
    pillar: "foundation",
    phase: 3,
    oneLiner: "What you own, who you pay, and when contracts and licences renew.",
    summary:
      "A record of your hardware, software, subscriptions and licences, the suppliers behind them, their contracts and support levels, and a plan for renewals and replacement.",
    whyItMatters:
      "Unused licences and forgotten renewals quietly waste money, and a supplier you never reviewed can become your security problem.",
    parts: [
      {
        name: "Assets",
        plain:
          "Hardware, software, SaaS and licence inventories with owner, location, lifecycle, warranty and replacement planning.",
      },
      {
        name: "Suppliers",
        plain:
          "Supplier list and contacts, contract owners and renewal dates, support levels, purchasing process, security reviews and SLA tracking.",
      },
      {
        name: "Licences and costs",
        plain:
          "Cloud, office, engineering and SaaS licences, removing unused ones, renewal planning and budget forecasts.",
      },
    ],
    warningSigns: [
      "Contracts renew automatically without review.",
      "You pay for licences of people who left.",
      "Nobody knows when laptop warranties expire.",
    ],
    quickWins: [
      "Put all contracts and renewal dates in one calendar.",
      "Review licence use each quarter and cancel unused seats.",
      "Tag hardware and record warranty dates.",
    ],
    questions: [
      "Which renewals are coming in the next 90 days?",
      "Do we review a supplier's security before signing?",
      "How much do we spend on licences nobody uses?",
    ],
    related: ["business-apps", "company-context", "cloud"],
  },
  {
    slug: "ai",
    title: "Artificial intelligence",
    technical: "AI policy, agentic AI, training and on-premises AI",
    pillar: "applications",
    phase: 4,
    oneLiner: "Using AI tools safely: rules, pilots, training and your own AI servers.",
    summary:
      "Staff already use AI tools. This area covers a clear policy on what is allowed, a controlled pilot for AI agents that can take actions, training for everyone, and, if needed, AI models running on your own hardware.",
    whyItMatters:
      "Pasting customer or confidential data into the wrong tool can leak it, and AI answers can be wrong. Clear rules and human review let you get the benefits without the risks.",
    parts: [
      {
        name: "Policy",
        plain:
          "An acceptable-use policy, approved and forbidden tools and uses, which data may go into AI, a request process for new tools and reviewed data agreements with vendors.",
      },
      {
        name: "AI agents pilot",
        plain:
          "Defined use cases and hard limits, chosen participants, allowed and forbidden actions, human checkpoints, incident response and criteria (including EU AI Act labelling) before wider rollout.",
      },
      {
        name: "Training",
        plain:
          "AI basics for all staff, deeper training for builders, awareness of AI-powered phishing, deepfakes and voice cloning, and the risks of what goes in and what comes out.",
      },
      {
        name: "Own AI cluster",
        plain:
          "GPU servers, which models run and for what, the serving layer, access control, GPU sharing, monitoring, model updates and network isolation.",
      },
    ],
    warningSigns: [
      "There is no written AI policy, or nobody has read it.",
      "Staff paste customer data into free AI tools.",
      "AI output goes to customers without a human check.",
    ],
    quickWins: [
      "Publish a one-page AI policy with approved tools and forbidden data.",
      "Run a short AI awareness session including deepfake and voice-clone scams.",
      "Require a human review for AI output in critical work.",
    ],
    questions: [
      "Which AI tools are approved, and what data must never go into them?",
      "How do we evaluate a new AI tool before people use it?",
      "Who reviews AI agents that can take actions on their own?",
    ],
    related: ["security-compliance", "business-apps", "company-context"],
  },
  {
    slug: "security-compliance",
    title: "Security and compliance",
    technical: "Security governance, vulnerability management, secrets and compliance",
    pillar: "visibility",
    phase: 4,
    oneLiner:
      "Managing risk, patching weaknesses, protecting secrets and meeting GDPR and ISO 27001.",
    summary:
      "Security ties everything together: an owner and a risk list, finding and fixing weaknesses, keeping passwords, keys and certificates safe, watching for attacks, and showing customers and regulators that you meet your obligations.",
    whyItMatters:
      "Customers increasingly ask for proof of security, and regulators expect GDPR compliance. A simple, owned programme protects the business and helps win contracts.",
    parts: [
      {
        name: "Governance",
        plain:
          "A security management system, risk register, owner and roadmap, an exceptions process and regular awareness training.",
      },
      {
        name: "Weaknesses",
        plain:
          "Automatic vulnerability scans, patching, ranking risks and tracking fixes, checking what is exposed to the internet, penetration tests and reports.",
      },
      {
        name: "Secrets and certificates",
        plain:
          "A password vault, API and SSH keys, TLS certificates, expiry tracking and service account credentials, all inventoried and rotated.",
      },
      {
        name: "Operations and compliance",
        plain:
          "Central security logs (SIEM), incident response, phishing reporting, threat intelligence, block and allow lists, forensics and legal reporting, ISO 27001 alignment, GDPR, retention, audit evidence, supplier reviews and training records.",
      },
    ],
    warningSigns: [
      "Nobody owns security or keeps a risk list.",
      "Passwords and keys are shared in chats or spreadsheets.",
      "Incidents are fixed but never reviewed afterwards.",
    ],
    quickWins: [
      "Name a security owner and start a one-page risk register.",
      "Move shared passwords and keys into a password vault.",
      "Run an external exposure scan and fix the top findings.",
    ],
    questions: [
      "Are vulnerability scans automatic, and are findings tracked to a fix?",
      "Are secrets, keys and certificates inventoried and rotated?",
      "Have we done an ISO 27001 or GDPR gap analysis?",
    ],
    related: ["identity-access", "monitoring", "ai"],
  },
];

/** The order to tackle things in, from the most urgent risks to advanced maturity. */
export const PHASES: Record<Phase, { name: string; plain: string }> = {
  1: {
    name: "Fix first",
    plain:
      "Immediate risks: two-step login, admin accounts, backups, what is exposed to the internet, secrets, supplier access and any current incidents.",
  },
  2: {
    name: "Solid basics",
    plain:
      "A reliable baseline: accounts, devices, email and files, network, servers, storage, monitoring and engineering servers.",
  },
  3: {
    name: "Run the business",
    plain:
      "Business and engineering systems: computing clusters, code and automation, business apps, joiners and leavers, and assets.",
  },
  4: {
    name: "Grow with confidence",
    plain:
      "Advanced maturity: cloud strategy, AI governance, a security framework, automation and cost optimisation.",
  },
};

export const PILLARS: Record<Pillar, { name: string; question: string }> = {
  foundation: { name: "Foundation", question: "Who runs IT, and is it written down?" },
  identity: { name: "Identity", question: "Who can get in?" },
  devices: { name: "Devices", question: "Are our machines safe and up to date?" },
  network: { name: "Network", question: "How is everything connected and separated?" },
  applications: { name: "Applications", question: "Are our apps and services under control?" },
  data: { name: "Data", question: "Can we get our data back?" },
  visibility: { name: "Visibility", question: "Would we notice if something went wrong?" },
};

/** Display order: from "who can get in?" to "who runs IT?". */
export const PILLAR_ORDER: Pillar[] = [
  "identity",
  "devices",
  "network",
  "applications",
  "data",
  "visibility",
  "foundation",
];
