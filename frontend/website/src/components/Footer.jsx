import { Link } from "react-router-dom";

export default function Footer() {
    return (
        <footer className="ml-footer">
            <div className="ml-footer-top">

                <div className="ml-logo">
                    <div className="ml-logo-icon">
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                        >
                            <path
                                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                                stroke="#F5EBD6"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </div>

                    <span
                        className="ml-logo-text"
                        style={{ fontSize: 14 }}
                    >
                        Algo<span>Sprint</span>
                    </span>
                </div>

                <div className="ml-footer-links">

                    <Link
                        to="/privacy"
                        className="ml-footer-link"
                    >
                        Privacy
                    </Link>

                    <Link
                        to="/terms"
                        className="ml-footer-link"
                    >
                        Terms
                    </Link>

                    <a
                        href="#contact"
                        className="ml-footer-link"
                    >
                        Contact
                    </a>

                    <a
                        href="https://twitter.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-footer-link"
                    >
                        Twitter
                    </a>

                    <a
                        href="https://github.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-footer-link"
                    >
                        GitHub
                    </a>

                </div>
            </div>

            <div className="ml-footer-bottom">

                <span>© 2026 AlgoSprint</span>

                <span
                    className="ml-handwritten"
                    style={{ color: "#E5A653" }}
                >
                    made with ☕ and way too many late nights
                </span>

            </div>
        </footer>
    );
}