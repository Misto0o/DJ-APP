document.addEventListener('DOMContentLoaded', () => {
    // DON'T run intro animation immediately - wait for first-run modal to complete
    checkFirstRun();
});

// -------------------- Intro Animation --------------------
function initIntroAnimation() {
    const canvas = document.getElementById('intro-canvas');
    if (!canvas) return;

    // Make sure overlay is visible
    const overlay = document.getElementById('intro-overlay');
    overlay.style.display = 'flex';
    overlay.style.opacity = '1';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);

    const createParticles = (color) => {
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(500 * 3);
        for (let i = 0; i < positions.length; i++) {
            positions[i] = (Math.random() - 0.5) * 10;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({ color, size: 0.05 });
        return new THREE.Points(geo, mat);
    };

    const bluePoints = createParticles(0x3FAEFD);
    const orangePoints = createParticles(0xFF8C00);
    scene.add(bluePoints, orangePoints);

    function animate() {
        requestAnimationFrame(animate);
        bluePoints.rotation.x += 0.001;
        bluePoints.rotation.y += 0.001;
        orangePoints.rotation.x -= 0.0008;
        orangePoints.rotation.y -= 0.0008;
        renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Reset text opacity for animation
    gsap.set("#intro-text h1", { opacity: 0, y: 0 });
    gsap.set("#intro-text p", { opacity: 0, y: 0 });

    gsap.timeline({ onComplete: removeIntro })
        .to("#intro-text h1", { duration: 1.5, opacity: 1, y: -20, ease: "bounce.out" })
        .to("#intro-text p", { duration: 1, opacity: 1, y: -10, ease: "power2.out" }, "-=0.5")
        .to("#intro-overlay", { duration: 1, opacity: 0, pointerEvents: "none", delay: 1 });
}

function removeIntro() {
    document.getElementById('intro-overlay').style.display = 'none';
}

// -------------------- First Run --------------------
async function checkFirstRun() {
    // ALWAYS show the upload modal on every page load
    showFirstRunModal();
}

function showFirstRunModal() {
    const modal = document.getElementById('first-run-modal');
    if (!modal) return;
    modal.classList.add('active');
    setupDropZone();
}

function setupDropZone() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('first-run-input');
    const doneBtn = document.getElementById('done-btn');

    if (!dropZone || !fileInput) return;

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files, true);
    });

    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files, true);
    });

    if (doneBtn) {
        doneBtn.addEventListener('click', () => {
            // Close the modal
            document.getElementById('first-run-modal').classList.remove('active');

            // NOW run the intro animation
            initIntroAnimation();

            // Render library (will happen after intro completes)
            renderLibrary();
        });
    }
}

// -------------------- Reset Function --------------------
window.resetApp = async function () {
    console.log('Resetting app...');

    localStorage.removeItem('djapp-initialized');
    localStorage.removeItem('djapp-songs');

    const dbName = "DJAppDB";

    try {
        const deleteRequest = indexedDB.deleteDatabase(dbName);

        deleteRequest.onsuccess = () => {
            console.log('IndexedDB deleted successfully');
            location.reload();
        };

        deleteRequest.onerror = () => {
            console.error('Error deleting IndexedDB');
            location.reload();
        };

        deleteRequest.onblocked = () => {
            console.warn('IndexedDB deletion blocked - closing connections...');
            setTimeout(() => location.reload(), 500);
        };
    } catch (error) {
        console.error('Error resetting app:', error);
        location.reload();
    }
};