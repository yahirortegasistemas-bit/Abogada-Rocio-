// ======================================================
// PRELOADER
// ======================================================
window.addEventListener('load', () => {
    const preloader = document.getElementById('preloader');
    if (preloader) {
        setTimeout(() => {
            preloader.classList.add('hidden');
        }, 1200);
    }
});

// ======================================================
// CARGA DIFERIDA - Three.js se inicia después de cargar
// ======================================================
let threeInitialized = false;
let scene, camera, renderer;
let mainGroup, particles, glowParticles;
let balanzaArm, plateLeft, plateRight;
let mouseX = 0, mouseY = 0;
let targetRotationX = 0, targetRotationY = 0;
let autoRotate = true;

// Estado de la animación de "equilibrio" de la balanza al cargar
let balanceStartTime = null;
const BALANCE_DURATION = 2600; // ms
const BALANCE_START_TILT = 0.22; // radianes, desequilibrio inicial

function initThreeWhenReady() {
    if (typeof THREE !== 'undefined' && !threeInitialized) {
        threeInitialized = true;
        initThree();
        console.log('✅ Templo de Justicia 3D cargado');
    } else if (typeof THREE === 'undefined') {
        setTimeout(initThreeWhenReady, 200);
    }
}

// ======================================================
// THREE.JS - TEMPLO DE JUSTICIA 3D (VERSIÓN OPTIMIZADA)
// La balanza es el elemento protagonista: entra desequilibrada
// y se nivela suavemente, simbolizando que la justicia se restaura.
// Las columnas quedan como marco discreto, no como protagonistas.
// ======================================================
function initThree() {
    const container = document.getElementById('three-container');
    if (!container) return;

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 3.2, 16);
    camera.lookAt(0, 2.0, 0);

    renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power"
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);

    // En pantallas pequeñas, reducimos aún más la carga
    const isMobile = container.clientWidth < 768;

    container.appendChild(renderer.domElement);

    mainGroup = new THREE.Group();
    scene.add(mainGroup);

    // ===== MATERIALES =====
    const goldLine = new THREE.LineBasicMaterial({
        color: 0xc9a84c,
        transparent: true,
        opacity: 0.10,
    });

    const goldLineStrong = new THREE.LineBasicMaterial({
        color: 0xe8d5a3,
        transparent: true,
        opacity: 0.55,
    });

    const goldLineLight = new THREE.LineBasicMaterial({
        color: 0xc9a84c,
        transparent: true,
        opacity: 0.05,
    });

    const goldLineMedium = new THREE.LineBasicMaterial({
        color: 0xc9a84c,
        transparent: true,
        opacity: 0.20,
    });

    const goldLineGlow = new THREE.LineBasicMaterial({
        color: 0xffdd88,
        transparent: true,
        opacity: 0.7,
    });

    // ======================================================
    // ===== 1. COLUMNAS DEL TEMPLO (reducidas a 6, marco discreto) =====
    // ======================================================
    const columnPositions = [];
    const numColumns = 6;
    for (let i = 0; i < numColumns; i++) {
        const angle = (i / numColumns) * Math.PI * 2;
        const radius = 5.4;
        columnPositions.push({
            x: radius * Math.cos(angle),
            z: radius * Math.sin(angle)
        });
    }

    columnPositions.forEach((pos, index) => {
        const colGroup = new THREE.Group();
        colGroup.position.set(pos.x, 0, pos.z);
        mainGroup.add(colGroup);

        const height = 4.5;
        const points = [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, height, 0)
        ];
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geo, index % 2 === 0 ? goldLine : goldLineLight);
        colGroup.add(line);

        // Base de la columna
        const basePoints = [];
        const baseRadius = 0.14;
        for (let j = 0; j <= 12; j++) {
            const theta = (j / 12) * Math.PI * 2;
            basePoints.push(new THREE.Vector3(
                baseRadius * Math.cos(theta),
                0.05,
                baseRadius * Math.sin(theta)
            ));
        }
        const baseGeo = new THREE.BufferGeometry().setFromPoints(basePoints);
        colGroup.add(new THREE.Line(baseGeo, goldLineLight));

        // Capitel
        const capitelPoints = [];
        const capitelRadius = 0.22;
        for (let j = 0; j <= 12; j++) {
            const theta = (j / 12) * Math.PI * 2;
            capitelPoints.push(new THREE.Vector3(
                capitelRadius * Math.cos(theta),
                height,
                capitelRadius * Math.sin(theta)
            ));
        }
        const capitelGeo = new THREE.BufferGeometry().setFromPoints(capitelPoints);
        colGroup.add(new THREE.Line(capitelGeo, goldLineMedium));
    });

    // ======================================================
    // ===== 2. TECHO (anillos superiores, sutiles) =====
    // ======================================================
    const roofRings = isMobile ? 3 : 5;
    for (let i = 0; i < roofRings; i++) {
        const radius = 2.8 + i * 0.7;
        const y = 4.7 + i * 0.04;
        const points = [];
        for (let j = 0; j <= 44; j++) {
            const theta = (j / 44) * Math.PI * 2;
            const wave = Math.sin(theta * 4 + i) * 0.04;
            points.push(new THREE.Vector3(
                (radius + wave) * Math.cos(theta),
                y + Math.sin(theta * 3 + i * 0.5) * 0.03,
                (radius + wave) * Math.sin(theta)
            ));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        mainGroup.add(new THREE.Line(geo, i % 2 === 0 ? goldLineMedium : goldLineLight));
    }

    // ======================================================
    // ===== 3. BALANZA CENTRAL — ELEMENTO PROTAGONISTA =====
    // Se agrupa el brazo + platos en balanzaArm para poder
    // animar su inclinación (efecto de "equilibrio restaurado").
    // ======================================================
    balanzaArm = new THREE.Group();
    balanzaArm.position.set(0, 3.0, 0); // pivote del brazo
    mainGroup.add(balanzaArm);

    // Brazo principal (ahora más grueso visualmente con doble línea)
    const armPoints1 = [
        new THREE.Vector3(-2.7, 0, 0),
        new THREE.Vector3(2.7, 0, 0)
    ];
    const armGeo1 = new THREE.BufferGeometry().setFromPoints(armPoints1);
    balanzaArm.add(new THREE.Line(armGeo1, goldLineStrong));

    const armPoints2 = [
        new THREE.Vector3(-2.7, 0.05, 0.04),
        new THREE.Vector3(2.7, 0.05, 0.04)
    ];
    const armGeo2 = new THREE.BufferGeometry().setFromPoints(armPoints2);
    balanzaArm.add(new THREE.Line(armGeo2, goldLineLight));

    // Orbe central del brazo (punto de apoyo brillante)
    const orbPoints = [];
    for (let j = 0; j <= 20; j++) {
        const theta = (j / 20) * Math.PI * 2;
        orbPoints.push(new THREE.Vector3(0.12 * Math.cos(theta), 0.12 * Math.sin(theta), 0));
    }
    const orbGeo = new THREE.BufferGeometry().setFromPoints(orbPoints);
    balanzaArm.add(new THREE.Line(orbGeo, goldLineGlow));

    // Columna central (fija, no rota con el brazo)
    const pillarPoints = [
        new THREE.Vector3(0, 0.5, 0),
        new THREE.Vector3(0, 3.0, 0)
    ];
    const pillarGeo = new THREE.BufferGeometry().setFromPoints(pillarPoints);
    mainGroup.add(new THREE.Line(pillarGeo, goldLineStrong));

    // Base de la balanza (fija)
    const basePoints = [
        new THREE.Vector3(-0.45, 0.5, 0),
        new THREE.Vector3(0.45, 0.5, 0),
        new THREE.Vector3(0, 0.1, 0),
        new THREE.Vector3(-0.45, 0.5, 0)
    ];
    const baseGeo = new THREE.BufferGeometry().setFromPoints(basePoints);
    mainGroup.add(new THREE.Line(baseGeo, goldLineMedium));

    // Platos — cuelgan del brazo, se añaden a balanzaArm para heredar la inclinación
    plateLeft = new THREE.Group();
    plateLeft.position.set(-2.7, 0, 0);
    balanzaArm.add(plateLeft);

    plateRight = new THREE.Group();
    plateRight.position.set(2.7, 0, 0);
    balanzaArm.add(plateRight);

    [plateLeft, plateRight].forEach((plateGroup) => {
        // Cadenas
        for (let i = -1; i <= 1; i += 1) {
            const chainPoints = [
                new THREE.Vector3(i * 0.28, 0, 0),
                new THREE.Vector3(i * 0.28, -1.2, 0)
            ];
            const chainGeo = new THREE.BufferGeometry().setFromPoints(chainPoints);
            plateGroup.add(new THREE.Line(chainGeo, goldLineLight));
        }

        // Plato exterior
        const platePoints = [];
        for (let j = 0; j <= 24; j++) {
            const theta = (j / 24) * Math.PI * 2;
            const r = 0.55 + Math.sin(theta * 4) * 0.04;
            platePoints.push(new THREE.Vector3(r * Math.cos(theta), -1.2, r * Math.sin(theta)));
        }
        const plateGeo = new THREE.BufferGeometry().setFromPoints(platePoints);
        plateGroup.add(new THREE.Line(plateGeo, goldLineStrong));

        // Plato interior
        const innerPoints = [];
        for (let j = 0; j <= 16; j++) {
            const theta = (j / 16) * Math.PI * 2;
            const r = 0.28;
            innerPoints.push(new THREE.Vector3(r * Math.cos(theta), -1.18, r * Math.sin(theta)));
        }
        const innerGeo = new THREE.BufferGeometry().setFromPoints(innerPoints);
        plateGroup.add(new THREE.Line(innerGeo, goldLineLight));
    });

    // Arranca inclinada — se nivelará en la animación de entrada
    balanzaArm.rotation.z = BALANCE_START_TILT;

    // ======================================================
    // ===== 4. ANILLOS CONCÉNTRICOS EN EL SUELO (discretos) =====
    // ======================================================
    const floorRings = isMobile ? 4 : 6;
    for (let i = 0; i < floorRings; i++) {
        const radius = 1.4 + i * 0.6;
        const y = 0.1 + Math.sin(i * 0.5) * 0.02;
        const points = [];
        for (let j = 0; j <= 44; j++) {
            const theta = (j / 44) * Math.PI * 2;
            const wave = Math.sin(theta * 3 + i * 0.5) * 0.03;
            points.push(new THREE.Vector3(
                (radius + wave) * Math.cos(theta),
                y,
                (radius + wave) * Math.sin(theta)
            ));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        mainGroup.add(new THREE.Line(geo, i % 2 === 0 ? goldLineMedium : goldLineLight));
    }

    // ======================================================
    // ===== 5. PARTÍCULAS DORADAS (reducidas para rendimiento) =====
    // ======================================================
    const particleCount = isMobile ? 500 : 1000;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
        const radius = 3 + Math.random() * 10;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);
        positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.25 + 1.8;
        positions[i * 3 + 2] = radius * Math.cos(phi);

        const color = new THREE.Color().setHSL(0.1 + Math.random() * 0.05, 0.6, 0.3 + Math.random() * 0.3);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particleMaterial = new THREE.PointsMaterial({
        size: 0.05,
        vertexColors: true,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
    });

    particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // ===== Partículas de brillo (reducidas) =====
    const glowCount = isMobile ? 120 : 250;
    const glowPositions = new Float32Array(glowCount * 3);

    for (let i = 0; i < glowCount; i++) {
        const radius = 4 + Math.random() * 12;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);
        glowPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        glowPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.2 + 1.8;
        glowPositions[i * 3 + 2] = radius * Math.cos(phi);
    }

    const glowGeometry = new THREE.BufferGeometry();
    glowGeometry.setAttribute('position', new THREE.BufferAttribute(glowPositions, 3));

    const glowMaterial = new THREE.PointsMaterial({
        size: 0.025,
        color: 0xe8d5a3,
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending,
    });

    glowParticles = new THREE.Points(glowGeometry, glowMaterial);
    scene.add(glowParticles);

    // ======================================================
    // ===== 6. ILUMINACIÓN (sin sombras, más liviano) =====
    // ======================================================
    const ambientLight = new THREE.AmbientLight(0x404060, 0.45);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffeedd, 1.1);
    mainLight.position.set(5, 12, 10);
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x4488ff, 0.22);
    fillLight.position.set(-6, 3, -6);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xc9a84c, 0.45);
    rimLight.position.set(-5, 8, -8);
    scene.add(rimLight);

    // ======================================================
    // ===== 7. EVENTOS =====
    // ======================================================
    window.addEventListener('resize', onResize);
    document.addEventListener('mousemove', onMouseMove);

    balanceStartTime = performance.now();
    animate();
}

// ======================================================
// MOUSE MOVE - Interacción
// ======================================================
function onMouseMove(event) {
    const x = (event.clientX / window.innerWidth) * 2 - 1;
    const y = (event.clientY / window.innerHeight) * 2 - 1;
    targetRotationX = x * 0.3;
    targetRotationY = y * 0.2;
    autoRotate = false;
}

// ======================================================
// RESIZE - Responsive
// ======================================================
function onResize() {
    const container = document.getElementById('three-container');
    if (!container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

// Easing suave para el efecto de equilibrio (easeOutCubic)
function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

// ======================================================
// ANIMATE - Loop de animación
// ======================================================
function animate() {
    requestAnimationFrame(animate);

    const time = Date.now() * 0.001;

    if (particles) {
        particles.rotation.y += 0.0005;
        particles.rotation.x = Math.sin(time * 0.04) * 0.015;
    }

    if (glowParticles) {
        glowParticles.rotation.y -= 0.0003;
        glowParticles.rotation.x = Math.sin(time * 0.03 + 1) * 0.01;
    }

    // Animación de entrada: la balanza pasa de desequilibrada a nivelada,
    // y luego queda con un balanceo sutil permanente (símbolo de justicia viva, no estática)
    if (balanzaArm) {
        if (balanceStartTime !== null) {
            const elapsed = performance.now() - balanceStartTime;
            const t = Math.min(elapsed / BALANCE_DURATION, 1);
            const eased = easeOutCubic(t);
            const settleWobble = Math.sin(time * 1.4) * 0.008 * (1 - eased * 0.7);
            balanzaArm.rotation.z = BALANCE_START_TILT * (1 - eased) + settleWobble;
            if (t >= 1) {
                balanceStartTime = null; // pasa al balanceo permanente sutil de abajo
            }
        } else {
            balanzaArm.rotation.z = Math.sin(time * 0.4) * 0.012;
        }
    }

    if (mainGroup) {
        if (autoRotate) {
            mainGroup.rotation.y += 0.0035;
            mainGroup.rotation.x = Math.sin(time * 0.12) * 0.015;
        } else {
            mainGroup.rotation.y += (targetRotationX - mainGroup.rotation.y) * 0.02;
            mainGroup.rotation.x += (targetRotationY * 0.3 - mainGroup.rotation.x) * 0.02;
        }

        mainGroup.position.y = Math.sin(time * 0.15) * 0.02;
    }

    renderer.render(scene, camera);
}

// ======================================================
// INICIO - Carga diferida de Three.js
// ======================================================
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initThreeWhenReady, 300);
});

// ======================================================
// MENÚ HAMBURGUESA
// ======================================================
const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('navMenu');

if (hamburger && navMenu) {
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navMenu.classList.toggle('open');
    });

    document.querySelectorAll('.nav-menu a').forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('active');
            navMenu.classList.remove('open');
        });
    });
}

// ======================================================
// HEADER SCROLL
// ======================================================
const header = document.getElementById('header');

window.addEventListener('scroll', () => {
    if (!header) return;
    if (window.scrollY > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});

// ======================================================
// CONTADORES ANIMADOS
// ======================================================
const statNumbers = document.querySelectorAll('.stat-number');

const animateCounter = (el) => {
    const target = parseInt(el.getAttribute('data-count'), 10);
    const duration = 2000;
    const increment = target / (duration / 16);
    let current = 0;

    const updateCounter = () => {
        current += increment;
        if (current < target) {
            el.textContent = Math.floor(current);
            requestAnimationFrame(updateCounter);
        } else {
            el.textContent = target + (target > 100 ? '%' : '+');
        }
    };

    updateCounter();
};

const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            animateCounter(entry.target);
            statsObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.3 });

statNumbers.forEach(el => statsObserver.observe(el));

// ======================================================
// TABS DE SERVICIOS
// ======================================================
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanels.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const tabId = btn.getAttribute('data-tab');
        const panel = document.getElementById(`tab-${tabId}`);
        if (panel) panel.classList.add('active');
    });
});

// ======================================================
// FORMULARIO DE CONTACTO
// ======================================================
const contactForm = document.getElementById('contactForm');
const formMessage = document.getElementById('formMessage');

if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const nombre = document.getElementById('nombre').value.trim();
        const telefono = document.getElementById('telefono').value.trim();
        const email = document.getElementById('email').value.trim();
        const captcha = document.getElementById('captcha').value.trim();
        const terminos = document.getElementById('terminos').checked;

        if (!nombre || !telefono || !email || !captcha) {
            formMessage.textContent = 'Por favor, completa todos los campos obligatorios.';
            formMessage.className = 'form-message error';
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            formMessage.textContent = 'Ingresa un correo electrónico válido.';
            formMessage.className = 'form-message error';
            return;
        }

        if (captcha !== '9') {
            formMessage.textContent = 'El resultado de la operación es incorrecto.';
            formMessage.className = 'form-message error';
            return;
        }

        if (!terminos) {
            formMessage.textContent = 'Debes aceptar los Términos y condiciones.';
            formMessage.className = 'form-message error';
            return;
        }

        formMessage.textContent = '✅ ¡Mensaje enviado con éxito! Me pondré en contacto contigo a la brevedad.';
        formMessage.className = 'form-message success';

        setTimeout(() => {
            contactForm.reset();
        }, 3000);

        setTimeout(() => {
            formMessage.className = 'form-message';
            formMessage.textContent = '';
        }, 6000);
    });
}

// ======================================================
// SCROLL SUAVE
// ======================================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
            e.preventDefault();
            const headerOffset = 80;
            const elementPosition = targetElement.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    });
});

// ======================================================
// VOLTEAR TARJETAS - CLIC + HOVER
// ======================================================
document.querySelectorAll('.flip-card').forEach(card => {
    card.addEventListener('click', function(e) {
        if (e.target.closest('.btn-flip')) return;
        this.classList.toggle('flipped');
    });

    card.addEventListener('mouseenter', function() {
        this.classList.add('flipped');
    });
    card.addEventListener('mouseleave', function() {
        this.classList.remove('flipped');
    });

    card.setAttribute('tabindex', '0');
    card.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.classList.toggle('flipped');
        }
    });
});

// ======================================================
// MARCADOR ACTIVO EN EL MENÚ AL HACER SCROLL
// ======================================================
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-menu a');

window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(section => {
        const sectionTop = section.offsetTop - 120;
        if (window.scrollY >= sectionTop) {
            current = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });
});