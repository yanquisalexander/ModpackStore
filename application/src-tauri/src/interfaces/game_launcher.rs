pub trait GameLauncher {
    fn launch(&self) -> Result<std::process::Child, String>;
}
